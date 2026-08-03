import { describe, expect, it } from 'vitest'
import { monteCarlo, projectDeterministic, projectScenarios } from '../projection.js'

describe('projectDeterministic', () => {
  it('returns one entry per year', () => {
    const r = projectDeterministic(100000, 0, 0.12, 5)
    expect(r).toHaveLength(5)
    expect(r[0].year).toBe(1)
    expect(r[4].year).toBe(5)
  })

  it('lump-only grows monotonically with positive return', () => {
    const r = projectDeterministic(100000, 0, 0.12, 10)
    for (let i = 1; i < r.length; i++) {
      expect(r[i].value).toBeGreaterThan(r[i - 1].value)
    }
  })

  it('zero contribution zero return = principal stays flat', () => {
    const r = projectDeterministic(50000, 0, 0, 3)
    for (const { value } of r) expect(value).toBeCloseTo(50000, 1)
  })

  it('SIP adds value', () => {
    const rNoSip = projectDeterministic(100000, 0, 0.12, 10)
    const rSip = projectDeterministic(100000, 5000, 0.12, 10)
    expect(rSip[9].value).toBeGreaterThan(rNoSip[9].value)
  })
})

describe('projectScenarios', () => {
  it('bull > base > bear at each year', () => {
    const r = projectScenarios(100000, 5000, 0.12, 0.15, 10)
    r.forEach(({ bear, base, bull }) => {
      expect(bull).toBeGreaterThan(base)
      expect(base).toBeGreaterThan(bear)
    })
  })

  it('does not blow up with high volatility', () => {
    expect(() => projectScenarios(100000, 1000, 0.05, 0.9, 5)).not.toThrow()
  })
})

describe('monteCarlo', () => {
  it('deterministic: same seed -> same output', () => {
    const a = monteCarlo(100000, 5000, 0.12, 0.15, 10, 500, 99)
    const b = monteCarlo(100000, 5000, 0.12, 0.15, 10, 500, 99)
    expect(a).toEqual(b)
  })

  it('different seeds -> different p50', () => {
    const a = monteCarlo(100000, 5000, 0.12, 0.15, 10, 500, 1)
    const b = monteCarlo(100000, 5000, 0.12, 0.15, 10, 500, 2)
    // Very unlikely to be equal for different seeds
    expect(a[9].p50).not.toBe(b[9].p50)
  })

  it('p10 < p50 < p90 at each year', () => {
    const r = monteCarlo(100000, 5000, 0.12, 0.15, 10, 1000, 42)
    r.forEach(({ p10, p50, p90 }) => {
      expect(p10).toBeLessThan(p50)
      expect(p50).toBeLessThan(p90)
    })
  })

  it('returns one entry per year', () => {
    const r = monteCarlo(100000, 5000, 0.12, 0.15, 10, 200, 7)
    expect(r).toHaveLength(10)
    expect(r[0].year).toBe(1)
    expect(r[9].year).toBe(10)
  })

  it('positive return -> p50 grows over time', () => {
    const r = monteCarlo(100000, 5000, 0.14, 0.1, 15, 500, 42)
    expect(r[14].p50).toBeGreaterThan(r[0].p50)
  })
})
