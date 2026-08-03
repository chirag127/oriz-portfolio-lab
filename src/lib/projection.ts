/**
 * Wealth projection: deterministic year-by-year, scenario bands, seeded Monte Carlo.
 * No external deps; PRNG is mulberry32 + Box-Muller for reproducibility.
 */

import { compound, sipFutureValue } from './finmath.js'

// ---------------------------------------------------------------------------
// PRNG — mulberry32 (32-bit, fast, seedable)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}

/** Box-Muller: two uniforms -> one standard normal */
function boxMullerNormal(rand: () => number): () => number {
  let spare: number | null = null
  return () => {
    if (spare !== null) {
      const v = spare
      spare = null
      return v
    }
    let u: number, v: number, s: number
    do {
      u = rand() * 2 - 1
      v = rand() * 2 - 1
      s = u * u + v * v
    } while (s >= 1 || s === 0)
    const m = Math.sqrt((-2 * Math.log(s)) / s)
    spare = v * m
    return u * m
  }
}

// ---------------------------------------------------------------------------
// Deterministic projection
// ---------------------------------------------------------------------------

/**
 * Year-by-year future value of a lump sum + ongoing SIP.
 * Combines compound() + sipFutureValue() at each year.
 */
export function projectDeterministic(
  startAmount: number,
  monthlyContribution: number,
  annualReturn: number,
  years: number,
): { year: number; value: number }[] {
  const result: { year: number; value: number }[] = []
  for (let y = 1; y <= years; y++) {
    const lump = compound(startAmount, annualReturn, y)
    const sip = sipFutureValue(monthlyContribution, annualReturn, y)
    result.push({ year: y, value: lump + sip })
  }
  return result
}

// ---------------------------------------------------------------------------
// Scenario bands
// ---------------------------------------------------------------------------

const MIN_BEAR_RETURN = -0.5 // floor: -50% so we don't divide by zero

/**
 * Bear = expectedReturn - volatility (floored at -50%)
 * Base = expectedReturn
 * Bull = expectedReturn + volatility
 */
export function projectScenarios(
  startAmount: number,
  monthly: number,
  expectedReturn: number,
  volatility: number,
  years: number,
): { year: number; bear: number; base: number; bull: number }[] {
  const bearReturn = Math.max(MIN_BEAR_RETURN, expectedReturn - volatility)
  const baseReturn = expectedReturn
  const bullReturn = expectedReturn + volatility

  const result: { year: number; bear: number; base: number; bull: number }[] = []
  for (let y = 1; y <= years; y++) {
    result.push({
      year: y,
      bear: compound(startAmount, bearReturn, y) + sipFutureValue(monthly, bearReturn, y),
      base: compound(startAmount, baseReturn, y) + sipFutureValue(monthly, baseReturn, y),
      bull: compound(startAmount, bullReturn, y) + sipFutureValue(monthly, bullReturn, y),
    })
  }
  return result
}

// ---------------------------------------------------------------------------
// Monte Carlo
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(Math.floor(p * sorted.length), sorted.length - 1)
  return sorted[idx]
}

/**
 * Simulate `sims` wealth paths (annual steps) with returns drawn from
 * Normal(expectedReturn, volatility) using a seeded PRNG.
 * Returns p10/p50/p90 percentile bands per year.
 *
 * Default sims = 1000 (browser-friendly).
 */
export function monteCarlo(
  startAmount: number,
  monthly: number,
  expectedReturn: number,
  volatility: number,
  years: number,
  sims: number = 1000,
  seed: number = 42,
): { year: number; p10: number; p50: number; p90: number }[] {
  const rand = mulberry32(seed)
  const normal = boxMullerNormal(rand)

  // Each path: array of length years
  const paths: number[][] = Array.from({ length: sims }, () => {
    let value = startAmount
    const yearly: number[] = []
    for (let y = 0; y < years; y++) {
      const r = expectedReturn + volatility * normal()
      // Lump grows, SIP added at start of each year (simple annual step)
      value = value * (1 + r) + monthly * 12
      yearly.push(value)
    }
    return yearly
  })

  return Array.from({ length: years }, (_, yi) => {
    const vals = paths.map((p) => p[yi]).sort((a, b) => a - b)
    return {
      year: yi + 1,
      p10: percentile(vals, 0.1),
      p50: percentile(vals, 0.5),
      p90: percentile(vals, 0.9),
    }
  })
}
