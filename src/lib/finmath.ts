/**
 * Core financial math — pure, deterministic, unit-tested.
 * All rates/returns are decimals; periods in years.
 */

/**
 * India ~10yr G-Sec yield used as risk-free rate.
 * Override by passing rf explicitly to sharpe().
 */
export const RISK_FREE_RATE = 0.068

/** Lump-sum future value: FV = P * (1 + r)^n */
export function compound(principal: number, annualRate: number, years: number): number {
  return principal * (1 + annualRate) ** years
}

/**
 * SIP future value with monthly compounding.
 * FV = M * [((1 + r_m)^n - 1) / r_m] where r_m = annualRate/12, n = years*12
 */
export function sipFutureValue(monthly: number, annualRate: number, years: number): number {
  const rm = annualRate / 12
  const n = years * 12
  if (Math.abs(rm) < 1e-12) return monthly * n
  return monthly * (((1 + rm) ** n - 1) / rm) * (1 + rm)
}

/** CAGR = (end/begin)^(1/years) - 1 */
export function cagr(begin: number, end: number, years: number): number {
  if (begin <= 0 || years <= 0) throw new RangeError('begin and years must be > 0')
  return (end / begin) ** (1 / years) - 1
}

/** Weighted mean return: sum(w_i * r_i) */
export function portfolioReturn(weights: number[], returns: number[]): number {
  if (weights.length !== returns.length) throw new RangeError('weights and returns length mismatch')
  return weights.reduce((sum, w, i) => sum + w * returns[i], 0)
}

/**
 * Portfolio volatility: sqrt(wᵀ Σ w)
 * Σ_ij = vol_i * vol_j * corr_ij
 * corr is a square matrix (same order as weights/vols).
 */
export function portfolioVolatility(weights: number[], vols: number[], corr: number[][]): number {
  const n = weights.length
  if (vols.length !== n || corr.length !== n) throw new RangeError('dimension mismatch')
  let variance = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * vols[i] * vols[j] * corr[i][j]
    }
  }
  return Math.sqrt(Math.max(0, variance))
}

/** Sharpe ratio = (ret - rf) / vol; returns 0 when vol === 0 */
export function sharpe(ret: number, vol: number, rf: number = RISK_FREE_RATE): number {
  if (vol === 0) return 0
  return (ret - rf) / vol
}
