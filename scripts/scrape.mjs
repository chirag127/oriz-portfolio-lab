// Nightly market-data scrape for portfolio-lab.
// Refreshes src/data/market.json with live index/gold/FX levels from free,
// keyless public endpoints. Each source is independent: one failing keeps
// the last committed value (graceful degrade). Run by .github/workflows/scrape.yml.
import { readFileSync, writeFileSync } from 'node:fs'
import { SOURCES } from '../src/data/market-data-urls.ts'

const OUT = 'src/data/market.json'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// Keep last-known values; only overwrite fields that fetch successfully.
let prev = {}
try {
  prev = JSON.parse(readFileSync(OUT, 'utf8'))
} catch {
  /* first run */
}

async function j(url, opts) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, ...opts })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

async function gold() {
  const [xau, fx] = await Promise.all([j(SOURCES.goldUsdOz), j(SOURCES.usdinr)])
  const usdPerOz = xau.price ?? xau.rate
  const usdinr = fx.rates?.INR
  if (!usdPerOz || !usdinr) throw new Error('gold/fx shape')
  // USD/oz -> INR per 10g (1 troy oz = 31.1035 g)
  return { gold_inr_10g: Math.round((usdPerOz * usdinr * 10) / 31.1035), usdinr: +usdinr.toFixed(2) }
}

async function nse() {
  // NSE rejects API calls without a session cookie — warm up first.
  const warm = await fetch(SOURCES.nseHome, { headers: { 'User-Agent': UA, Accept: 'text/html' } })
  const cookie = warm.headers.getSetCookie?.().join('; ') ?? warm.headers.get('set-cookie') ?? ''
  const data = await j(SOURCES.nseIndices, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Referer: SOURCES.nseHome, Cookie: cookie },
  })
  const find = (re) => data.data?.find((r) => re.test(r.index))?.last
  return {
    nifty50: find(/nifty 50$/i) ?? null,
    nifty500tri: find(/nifty 500/i) ?? null,
    sensex: find(/sensex/i) ?? null,
  }
}

async function sp500() {
  const data = await j(SOURCES.sp500)
  const q = data.chart?.result?.[0]
  const close = q?.meta?.regularMarketPrice ?? q?.indicators?.quote?.[0]?.close?.filter(Boolean).at(-1)
  if (!close) throw new Error('sp500 shape')
  return { sp500: Math.round(close) }
}

const out = { ...prev, _meta: { note: prev._meta?.note, updated: new Date().toISOString().slice(0, 10), source: 'scrape' } }

for (const [name, fn] of [
  ['gold', gold],
  ['nse', nse],
  ['sp500', sp500],
]) {
  try {
    Object.assign(out, await fn())
    console.log(`ok: ${name}`)
  } catch (e) {
    console.error(`skip ${name}: ${e.message} (keeping last value)`)
  }
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log('wrote', OUT)
