/**
 * Portfolio optimizer: efficient frontier via sampled portfolios,
 * max-Sharpe, min-variance, and simple risk-parity presets.
 *
 * EXCLUSION LOGIC: assets with expectedReturn < floor (default 0.12) are
 * excluded from optimization unless opts.includeBelowFloor = true.
 * Use flagBelowFloor() to surface warnings to the UI — the optimizer
 * drops them silently so the math is never poisoned, but the UI should
 * always show which assets were excluded.
 */

import { portfolioReturn, portfolioVolatility, RISK_FREE_RATE, sharpe } from './finmath.js'
import type { Allocation, Asset, CorrelationMatrix, PortfolioStats, Sleeve } from './types.js'

export interface OptimizerOpts {
  riskFree?: number
  sleeveCaps?: Partial<Record<Sleeve, number>>
  /** Expected-return floor for inclusion (default 0.12) */
  floor?: number
  /**
   * When false (default) assets below floor are excluded.
   * When true they are included anyway (use for research/comparison).
   */
  includeBelowFloor?: boolean
}

export interface FrontierPoint {
  allocation: Allocation
  stats: PortfolioStats
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns assets whose expectedReturn < floor. UI should warn on these. */
export function flagBelowFloor(assets: Asset[], floor = 0.12): Asset[] {
  return assets.filter((a) => a.expectedReturn < floor)
}

function buildCorrMatrix(assets: Asset[], corr: CorrelationMatrix): number[][] {
  return assets.map((a) =>
    assets.map((b) => {
      if (a.id === b.id) return 1
      return corr[a.id]?.[b.id] ?? corr[b.id]?.[a.id] ?? 0
    }),
  )
}

function computeStats(
  weights: number[],
  assets: Asset[],
  corrMatrix: number[][],
  rf: number,
): PortfolioStats {
  const ret = portfolioReturn(
    weights,
    assets.map((a) => a.expectedReturn),
  )
  const vol = portfolioVolatility(
    weights,
    assets.map((a) => a.volatility),
    corrMatrix,
  )
  return { expectedReturn: ret, volatility: vol, sharpe: sharpe(ret, vol, rf) }
}

function normalise(weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0)
  if (sum === 0) return weights.map(() => 1 / weights.length)
  return weights.map((w) => w / sum)
}

/** Clamp weights to per-sleeve caps, then re-normalise. */
function applyCaps(
  weights: number[],
  assets: Asset[],
  caps: Partial<Record<Sleeve, number>>,
): number[] {
  const capped = weights.map((w, i) => {
    const cap = caps[assets[i].sleeve]
    return cap !== undefined ? Math.min(w, cap) : w
  })
  return normalise(capped)
}

// ---------------------------------------------------------------------------
// Sampling — Dirichlet-ish via sorted-uniform stick-breaking
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random float in [0,1) based on index + offset. */
function prng(i: number, j: number): number {
  // Splitmix32-derived, no seed needed — deterministic from (i,j)
  let h = (i * 2654435761 + j * 2246822519) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x45d9f3b)
  h ^= h >>> 16
  return (h >>> 0) / 0x100000000
}

function sampleWeights(n: number, sampleIdx: number): number[] {
  if (n === 1) return [1]
  // Generate n-1 cut points, sort, diff -> stick-breaking weights
  const cuts = Array.from({ length: n - 1 }, (_, k) => prng(sampleIdx, k))
  cuts.sort((a, b) => a - b)
  const weights: number[] = []
  let prev = 0
  for (const c of cuts) {
    weights.push(c - prev)
    prev = c
  }
  weights.push(1 - prev)
  return weights
}

// ---------------------------------------------------------------------------
// Efficient Frontier
// ---------------------------------------------------------------------------

const MAX_CANDIDATES = 4000

/**
 * Sample portfolios, compute stats, return the non-dominated (Pareto) set
 * sorted by ascending volatility.
 *
 * "Non-dominated" here: no other point has both higher return AND lower vol.
 */
export function frontier(
  assets: Asset[],
  corr: CorrelationMatrix,
  opts: OptimizerOpts = {},
): FrontierPoint[] {
  const { riskFree = RISK_FREE_RATE, sleeveCaps, floor = 0.12, includeBelowFloor = false } = opts

  const eligible = includeBelowFloor ? assets : assets.filter((a) => a.expectedReturn >= floor)
  if (eligible.length === 0) return []

  const corrMatrix = buildCorrMatrix(eligible, corr)

  const candidates: FrontierPoint[] = []
  const n = eligible.length

  for (let s = 0; s < MAX_CANDIDATES; s++) {
    let w = sampleWeights(n, s)
    if (sleeveCaps) w = applyCaps(w, eligible, sleeveCaps)
    const stats = computeStats(w, eligible, corrMatrix, riskFree)
    candidates.push({
      allocation: eligible.map((a, i) => ({ assetId: a.id, weight: w[i] })),
      stats,
    })
  }

  // Pareto filter: keep p if no other point dominates it
  const pareto = candidates.filter(
    (p) =>
      !candidates.some(
        (q) =>
          q !== p &&
          q.stats.expectedReturn >= p.stats.expectedReturn &&
          q.stats.volatility <= p.stats.volatility &&
          (q.stats.expectedReturn > p.stats.expectedReturn ||
            q.stats.volatility < p.stats.volatility),
      ),
  )

  return pareto.sort((a, b) => a.stats.volatility - b.stats.volatility)
}

// ---------------------------------------------------------------------------
// Named presets
// ---------------------------------------------------------------------------

/** Portfolio with the highest Sharpe ratio among all sampled candidates. */
export function maxSharpe(
  assets: Asset[],
  corr: CorrelationMatrix,
  opts: OptimizerOpts = {},
): FrontierPoint {
  const { riskFree = RISK_FREE_RATE, sleeveCaps, floor = 0.12, includeBelowFloor = false } = opts
  const eligible = includeBelowFloor ? assets : assets.filter((a) => a.expectedReturn >= floor)
  if (eligible.length === 0) throw new RangeError('No eligible assets after floor filter')

  const corrMatrix = buildCorrMatrix(eligible, corr)
  const n = eligible.length

  const initW = sampleWeights(n, 0)
  let best: FrontierPoint = {
    allocation: eligible.map((a, i) => ({ assetId: a.id, weight: initW[i] })),
    stats: computeStats(initW, eligible, corrMatrix, riskFree),
  }

  for (let s = 1; s < MAX_CANDIDATES; s++) {
    let w = sampleWeights(n, s)
    if (sleeveCaps) w = applyCaps(w, eligible, sleeveCaps)
    const stats = computeStats(w, eligible, corrMatrix, riskFree)
    if (stats.sharpe > best.stats.sharpe) {
      best = {
        allocation: eligible.map((a, i) => ({ assetId: a.id, weight: w[i] })),
        stats,
      }
    }
  }

  return best
}

/** Portfolio with the lowest volatility among all sampled candidates. */
export function minVariance(
  assets: Asset[],
  corr: CorrelationMatrix,
  opts: OptimizerOpts = {},
): FrontierPoint {
  const { riskFree = RISK_FREE_RATE, sleeveCaps, floor = 0.12, includeBelowFloor = false } = opts
  const eligible = includeBelowFloor ? assets : assets.filter((a) => a.expectedReturn >= floor)
  if (eligible.length === 0) throw new RangeError('No eligible assets after floor filter')

  const corrMatrix = buildCorrMatrix(eligible, corr)
  const n = eligible.length

  const initW = sampleWeights(n, 0)
  let best: FrontierPoint = {
    allocation: eligible.map((a, i) => ({ assetId: a.id, weight: initW[i] })),
    stats: computeStats(initW, eligible, corrMatrix, riskFree),
  }

  for (let s = 1; s < MAX_CANDIDATES; s++) {
    let w = sampleWeights(n, s)
    if (sleeveCaps) w = applyCaps(w, eligible, sleeveCaps)
    const stats = computeStats(w, eligible, corrMatrix, riskFree)
    if (stats.volatility < best.stats.volatility) {
      best = {
        allocation: eligible.map((a, i) => ({ assetId: a.id, weight: w[i] })),
        stats,
      }
    }
  }

  return best
}

/**
 * Simple risk-parity: weights inversely proportional to volatility.
 * Ignores correlations (approximation). Respects floor but not sleeveCaps.
 */
export function riskParity(
  assets: Asset[],
  corr: CorrelationMatrix,
  opts: OptimizerOpts = {},
): FrontierPoint {
  const { riskFree = RISK_FREE_RATE, floor = 0.12, includeBelowFloor = false } = opts
  const eligible = includeBelowFloor ? assets : assets.filter((a) => a.expectedReturn >= floor)
  if (eligible.length === 0) throw new RangeError('No eligible assets after floor filter')

  const corrMatrix = buildCorrMatrix(eligible, corr)
  const rawW = eligible.map((a) => (a.volatility > 0 ? 1 / a.volatility : 0))
  const w = normalise(rawW)
  const stats = computeStats(w, eligible, corrMatrix, riskFree)
  return {
    allocation: eligible.map((a, i) => ({ assetId: a.id, weight: w[i] })),
    stats,
  }
}
