import { describe, expect, it } from 'vitest'
import {
  cagr,
  compound,
  portfolioReturn,
  portfolioVolatility,
  RISK_FREE_RATE,
  sharpe,
  sipFutureValue,
} from '../finmath.js'

describe('compound', () => {
  it('doubles at 100% over 1 year', () => {
    expect(compound(100, 1, 1)).toBe(200)
  })
  it('returns principal at 0% rate', () => {
    expect(compound(50000, 0, 10)).toBe(50000)
  })
  it('FV at 10% for 2 years', () => {
    expect(compound(100, 0.1, 2)).toBeCloseTo(121, 5)
  })
})

describe('sipFutureValue', () => {
  it('zero rate = sum of contributions', () => {
    expect(sipFutureValue(1000, 0, 2)).toBeCloseTo(24000, 0)
  })
  it('positive rate > sum of contributions', () => {
    expect(sipFutureValue(1000, 0.12, 10)).toBeGreaterThan(120000)
  })
})

describe('cagr', () => {
  it('doubles -> ~100% in 1yr', () => {
    expect(cagr(100, 200, 1)).toBeCloseTo(1, 5)
  })
  it('10x in 10yr -> 25.89%', () => {
    expect(cagr(1, 10, 10)).toBeCloseTo(0.2589, 3)
  })
  it('throws on begin=0', () => {
    expect(() => cagr(0, 100, 1)).toThrow()
  })
})

describe('portfolioReturn', () => {
  it('equal weights two assets', () => {
    expect(portfolioReturn([0.5, 0.5], [0.1, 0.2])).toBeCloseTo(0.15)
  })
  it('throws on length mismatch', () => {
    expect(() => portfolioReturn([1], [0.1, 0.2])).toThrow()
  })
})

describe('portfolioVolatility', () => {
  it('single asset = its own vol', () => {
    expect(portfolioVolatility([1], [0.2], [[1]])).toBeCloseTo(0.2)
  })
  it('two uncorrelated assets reduces vol', () => {
    const vol = portfolioVolatility(
      [0.5, 0.5],
      [0.2, 0.2],
      [
        [1, 0],
        [0, 1],
      ],
    )
    expect(vol).toBeLessThan(0.2)
  })
  it('perfectly correlated = weighted sum', () => {
    const vol = portfolioVolatility(
      [0.5, 0.5],
      [0.2, 0.2],
      [
        [1, 1],
        [1, 1],
      ],
    )
    expect(vol).toBeCloseTo(0.2)
  })
})

describe('sharpe', () => {
  it('basic calculation', () => {
    expect(sharpe(0.14, 0.2, 0.068)).toBeCloseTo((0.14 - 0.068) / 0.2)
  })
  it('zero vol -> 0', () => {
    expect(sharpe(0.1, 0, 0.068)).toBe(0)
  })
  it('defaults to RISK_FREE_RATE', () => {
    expect(RISK_FREE_RATE).toBe(0.068)
    expect(sharpe(0.14, 0.2)).toBeCloseTo((0.14 - 0.068) / 0.2)
  })
})
