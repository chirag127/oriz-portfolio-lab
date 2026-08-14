import { describe, expect, it } from 'vitest'
import { flagBelowFloor, frontier, maxReturn, maxSharpe, minVariance, riskParity } from '../optimizer.js'
import type { Asset, CorrelationMatrix } from '../types.js'

// ---------------------------------------------------------------------------
// Toy 3-asset fixture (all above 12% floor)
// ---------------------------------------------------------------------------

const ASSETS: Asset[] = [
  {
    id: 'eq',
    name: 'Indian Equity',
    sleeve: 'indian-equity',
    expectedReturn: 0.14,
    volatility: 0.2,
    belowFloor: false,
    riskNotes: '',
  },
  {
    id: 'gold',
    name: 'Gold',
    sleeve: 'gold',
    expectedReturn: 0.12,
    volatility: 0.15,
    belowFloor: false,
    riskNotes: '',
  },
  {
    id: 'p2p',
    name: 'P2P Lending',
    sleeve: 'p2p-lending',
    expectedReturn: 0.13,
    volatility: 0.08,
    belowFloor: false,
    riskNotes: '',
  },
]

const CORR: CorrelationMatrix = {
  eq: { eq: 1, gold: -0.1, p2p: 0.05 },
  gold: { eq: -0.1, gold: 1, p2p: 0.0 },
  p2p: { eq: 0.05, gold: 0.0, p2p: 1 },
}

function weightsSum(alloc: { assetId: string; weight: number }[]): number {
  return alloc.reduce((s, a) => s + a.weight, 0)
}

// ---------------------------------------------------------------------------
// maxSharpe
// ---------------------------------------------------------------------------

describe('maxSharpe', () => {
  it('weights sum to ~1', () => {
    const { allocation } = maxSharpe(ASSETS, CORR)
    expect(weightsSum(allocation)).toBeCloseTo(1, 6)
  })

  it('all weights >= 0 (long-only)', () => {
    const { allocation } = maxSharpe(ASSETS, CORR)
    for (const { weight } of allocation) expect(weight).toBeGreaterThanOrEqual(0)
  })

  it('maxSharpe.sharpe >= riskParity.sharpe on toy set', () => {
    const ms = maxSharpe(ASSETS, CORR)
    const rp = riskParity(ASSETS, CORR)
    expect(ms.stats.sharpe).toBeGreaterThanOrEqual(rp.stats.sharpe)
  })

  it('maxSharpe.sharpe >= minVariance.sharpe on toy set', () => {
    const ms = maxSharpe(ASSETS, CORR)
    const mv = minVariance(ASSETS, CORR)
    expect(ms.stats.sharpe).toBeGreaterThanOrEqual(mv.stats.sharpe)
  })
})

// ---------------------------------------------------------------------------
// minVariance
// ---------------------------------------------------------------------------

describe('minVariance', () => {
  it('weights sum to ~1', () => {
    const { allocation } = minVariance(ASSETS, CORR)
    expect(weightsSum(allocation)).toBeCloseTo(1, 6)
  })

  it('minVariance.vol <= maxSharpe.vol on toy set', () => {
    const mv = minVariance(ASSETS, CORR)
    const ms = maxSharpe(ASSETS, CORR)
    expect(mv.stats.volatility).toBeLessThanOrEqual(ms.stats.volatility + 1e-9)
  })
})

// ---------------------------------------------------------------------------
// riskParity
// ---------------------------------------------------------------------------

describe('riskParity', () => {
  it('weights sum to ~1', () => {
    const { allocation } = riskParity(ASSETS, CORR)
    expect(weightsSum(allocation)).toBeCloseTo(1, 6)
  })

  it('lower vol asset gets higher weight', () => {
    const { allocation } = riskParity(ASSETS, CORR)
    const p2pW = allocation.find((a) => a.assetId === 'p2p')?.weight
    const eqW = allocation.find((a) => a.assetId === 'eq')?.weight
    // p2p vol (0.08) < eq vol (0.20) -> p2p gets higher weight
    expect(p2pW).toBeGreaterThan(eqW ?? 0)
  })
})

// ---------------------------------------------------------------------------
// flagBelowFloor
// ---------------------------------------------------------------------------

describe('flagBelowFloor', () => {
  it('flags asset below floor', () => {
    const lowAsset: Asset = {
      id: 'low',
      name: 'Low Return',
      sleeve: 'arbitrage',
      expectedReturn: 0.07,
      volatility: 0.02,
      belowFloor: true,
      riskNotes: '',
    }
    const flagged = flagBelowFloor([...ASSETS, lowAsset], 0.12)
    expect(flagged.map((a) => a.id)).toContain('low')
    expect(flagged.map((a) => a.id)).not.toContain('eq')
  })

  it('returns empty when all assets above floor', () => {
    expect(flagBelowFloor(ASSETS, 0.12)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Below-floor exclusion
// ---------------------------------------------------------------------------

describe('below-floor exclusion', () => {
  const lowAsset: Asset = {
    id: 'arb',
    name: 'Arbitrage',
    sleeve: 'arbitrage',
    expectedReturn: 0.07,
    volatility: 0.02,
    belowFloor: true,
    riskNotes: '',
  }
  const assetsWithLow = [...ASSETS, lowAsset]
  const corrWithLow: CorrelationMatrix = {
    ...CORR,
    arb: { eq: 0, gold: 0, p2p: 0, arb: 1 },
    eq: { ...CORR.eq, arb: 0 },
    gold: { ...CORR.gold, arb: 0 },
    p2p: { ...CORR.p2p, arb: 0 },
  }

  it('excludes below-floor asset by default', () => {
    const { allocation } = maxSharpe(assetsWithLow, corrWithLow)
    const arbEntry = allocation.find((a) => a.assetId === 'arb')
    expect(arbEntry).toBeUndefined()
  })

  it('includes below-floor asset when includeBelowFloor=true', () => {
    const { allocation } = maxSharpe(assetsWithLow, corrWithLow, { includeBelowFloor: true })
    const ids = allocation.map((a) => a.assetId)
    expect(ids).toContain('arb')
  })
})

// ---------------------------------------------------------------------------
// sleeveCaps
// ---------------------------------------------------------------------------

describe('sleeveCaps', () => {
  it('no asset exceeds its sleeve cap', () => {
    const cap = 0.3
    const { allocation } = maxSharpe(ASSETS, CORR, {
      sleeveCaps: { 'indian-equity': cap },
    })
    const eqW = allocation.find((a) => a.assetId === 'eq')?.weight
    expect(eqW).toBeLessThanOrEqual(cap + 1e-9)
  })
})

// ---------------------------------------------------------------------------
// frontier
// ---------------------------------------------------------------------------

describe('frontier', () => {
  it('returns non-empty array', () => {
    const f = frontier(ASSETS, CORR)
    expect(f.length).toBeGreaterThan(0)
  })

  it('sorted by ascending volatility', () => {
    const f = frontier(ASSETS, CORR)
    for (let i = 1; i < f.length; i++) {
      expect(f[i].stats.volatility).toBeGreaterThanOrEqual(f[i - 1].stats.volatility)
    }
  })
})

// ---------------------------------------------------------------------------
// maxReturn (aggressive preset)
// ---------------------------------------------------------------------------

describe('maxReturn', () => {
  it('weights sum to ~1', () => {
    const { allocation } = maxReturn(ASSETS, CORR)
    expect(weightsSum(allocation)).toBeCloseTo(1, 6)
  })

  it('uncapped concentrates 100% into highest-return asset', () => {
    // eq (0.14) is the highest expectedReturn in the fixture
    const { allocation } = maxReturn(ASSETS, CORR)
    const eqW = allocation.find((a) => a.assetId === 'eq')?.weight
    expect(eqW).toBeCloseTo(1, 6)
  })

  it('expectedReturn equals the top asset return when uncapped', () => {
    const { stats } = maxReturn(ASSETS, CORR)
    expect(stats.expectedReturn).toBeCloseTo(0.14, 6)
  })

  it('respects sleeveCaps, filling from highest return down', () => {
    const cap = 0.3
    const { allocation } = maxReturn(ASSETS, CORR, { sleeveCaps: { 'indian-equity': cap } })
    const eqW = allocation.find((a) => a.assetId === 'eq')?.weight ?? 0
    expect(eqW).toBeLessThanOrEqual(cap + 1e-9)
    expect(weightsSum(allocation)).toBeCloseTo(1, 6)
  })

  it('never beats maxSharpe on Sharpe (aggressive != optimal)', () => {
    const mr = maxReturn(ASSETS, CORR)
    const ms = maxSharpe(ASSETS, CORR)
    expect(mr.stats.sharpe).toBeLessThanOrEqual(ms.stats.sharpe + 1e-9)
  })
})
