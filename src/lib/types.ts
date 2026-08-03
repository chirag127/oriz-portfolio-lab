/**
 * Shared domain types for the portfolio-analysis engine.
 * All return/rate values are decimals (0.14 = 14%).
 */

export type Sleeve =
  | 'indian-equity'
  | 'intl-equity'
  | 'global-value'
  | 'concentrated'
  | 'gold'
  | 'reits-invits'
  | 'p2p-lending'
  | 'arbitrage'
  | 'debt-alt'

export interface Asset {
  id: string
  name: string
  sleeve: Sleeve
  /** Ticker (for ETFs buyable via INDmoney), optional */
  ticker?: string
  /** Decimal e.g. 0.14 */
  expectedReturn: number
  /** Annualised stddev, decimal */
  volatility: number
  /** Forward P/E ratio (for value investing), optional */
  peRatio?: number
  histCagr?: {
    y1?: number
    y3?: number
    y5?: number
    y10?: number
  }
  /** True when expectedReturn < configured floor */
  belowFloor: boolean
  riskNotes: string
  sourceUrl?: string
}

/** Keyed by asset id: corr[a][b] in [-1, 1] */
export type CorrelationMatrix = Record<string, Record<string, number>>

/** weights must sum to 1; all weights >= 0 */
export type Allocation = { assetId: string; weight: number }[]

export interface PortfolioStats {
  expectedReturn: number
  volatility: number
  sharpe: number
}
