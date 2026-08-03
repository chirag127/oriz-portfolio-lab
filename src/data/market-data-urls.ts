/**
 * Free, keyless market-data endpoints for the nightly scrape.
 * Each has a primary + fallback so one source failing degrades gracefully
 * (mirrors the flow-fii-dii-activity resilient-fetch pattern).
 * NONE requires an API key. All are public/unofficial endpoints.
 */

export const SOURCES = {
  // Gold — metals price feed (INR per 10g derived from USD/oz + USDINR)
  goldUsdOz: 'https://api.gold-api.com/price/XAU',
  // FX — USD/INR
  usdinr: 'https://api.frankfurter.app/latest?from=USD&to=INR',
  // Indian indices — NSE unofficial (needs cookie warmup, see scrape.mjs)
  nseIndices: 'https://www.nseindia.com/api/allIndices',
  nseHome: 'https://www.nseindia.com/',
  // US index — Yahoo Finance unofficial chart API
  sp500: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=5d',
  // MF NAV — mfapi.in (free, community). Example scheme codes filled in scrape.
  mfApi: 'https://api.mfapi.in/mf',
} as const

export type SourceKey = keyof typeof SOURCES
