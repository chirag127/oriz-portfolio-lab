/**
 * Number formatting utilities for Indian rupee display.
 * Handles lakh/crore grouping and compact suffixes.
 */

/**
 * Indian grouping: rightmost 3 digits, then groups of 2.
 * e.g. 1234567 -> '₹12,34,567'
 */
export function inr(n: number): string {
  const rounded = Math.round(n)
  const isNeg = rounded < 0
  const abs = Math.abs(rounded).toString()

  let grouped: string
  if (abs.length <= 3) {
    grouped = abs
  } else {
    // Last 3 digits fixed, remaining grouped by 2
    const tail = abs.slice(-3)
    const head = abs.slice(0, -3)
    const parts: string[] = []
    let i = head.length
    while (i > 0) {
      parts.unshift(head.slice(Math.max(0, i - 2), i))
      i -= 2
    }
    grouped = `${parts.join(',')},${tail}`
  }

  return (isNeg ? '-₹' : '₹') + grouped
}

/**
 * Decimal to percentage string.
 * pct(0.145) -> '14.5%'
 * pct(0.145, 0) -> '15%'
 */
export function pct(n: number, dp = 1): string {
  return `${(n * 100).toFixed(dp)}%`
}

/**
 * Compact Indian rupee notation.
 * >= 1 Cr  -> '₹X.XXCr'
 * >= 1 L   -> '₹X.XL'
 * else     -> inr()
 */
export function compactInr(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''

  if (abs >= 1e7) {
    return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`
  }
  if (abs >= 1e5) {
    return `${sign}₹${(abs / 1e5).toFixed(1)}L`
  }
  return inr(n)
}
