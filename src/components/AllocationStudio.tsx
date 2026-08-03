/**
 * AllocationStudio — the core portfolio builder island.
 * Reads profile from localStorage (or ?profile= query param).
 * Runs maxSharpe/minVariance/riskParity optimizer.
 * Manual weight sliders + live stat recompute.
 * ProjectionChart with scenario bands + Monte Carlo cone.
 * HonestyPanel for below-floor assets.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import assetsData from '~/data/assets.json'
import { portfolioReturn, portfolioVolatility, RISK_FREE_RATE, sharpe } from '~/lib/finmath'
import { compactInr, inr, pct } from '~/lib/format'
import type { OptimizerOpts } from '~/lib/optimizer'
import { flagBelowFloor, maxSharpe, minVariance, riskParity } from '~/lib/optimizer'
import { monteCarlo, projectScenarios } from '~/lib/projection'
import type { RiskProfile } from '~/lib/questionnaire'
import type { Allocation, Asset, CorrelationMatrix, PortfolioStats } from '~/lib/types'
import HonestyPanel from './HonestyPanel'
import ProjectionChart from './ProjectionChart'

const LS_KEY = 'oriz:portfolio-lab:questionnaire'

const assets = assetsData.assets as Asset[]
const corr = assetsData.correlations as CorrelationMatrix

type Objective = 'maxSharpe' | 'minVariance' | 'riskParity'

const OBJ_LABELS: Record<Objective, string> = {
  maxSharpe: 'Max Sharpe',
  minVariance: 'Min Variance',
  riskParity: 'Risk Parity',
}

function getProfileFromLS(): RiskProfile {
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { profile?: RiskProfile }
      if (p.profile) return p.profile
    }
  } catch {
    /* ignore */
  }
  return 'balanced'
}

function getProfileFromQuery(): RiskProfile | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const p = params.get('profile') as RiskProfile | null
  if (p && ['conservative', 'balanced', 'growth', 'aggressive'].includes(p)) return p
  return null
}

/** Build weight map from allocation array */
function allocToWeights(alloc: Allocation): Record<string, number> {
  const m: Record<string, number> = {}
  for (const a of alloc) m[a.assetId] = a.weight
  return m
}

/** Recompute stats from a weights map over the full asset list */
function computeStatsFromWeights(
  weights: Record<string, number>,
  assetList: Asset[],
): PortfolioStats {
  const w: number[] = []
  const rets: number[] = []
  const vols: number[] = []
  const ids = assetList.map((a) => a.id)

  for (const a of assetList) {
    w.push(weights[a.id] ?? 0)
    rets.push(a.expectedReturn)
    vols.push(a.volatility)
  }

  const corrMatrix = ids.map((id1) =>
    ids.map((id2) => {
      if (id1 === id2) return 1
      return (
        (corr as Record<string, Record<string, number>>)[id1]?.[id2] ??
        (corr as Record<string, Record<string, number>>)[id2]?.[id1] ??
        0
      )
    }),
  )

  const ret = portfolioReturn(w, rets)
  const vol = portfolioVolatility(w, vols, corrMatrix)
  return { expectedReturn: ret, volatility: vol, sharpe: sharpe(ret, vol, RISK_FREE_RATE) }
}

export default function AllocationStudio() {
  const [profile, setProfile] = useState<RiskProfile>('balanced')
  const [objective, setObjective] = useState<Objective>('maxSharpe')
  const [includeBelowFloor, setIncludeBelowFloor] = useState(false)
  const [startAmount, setStartAmount] = useState(1_000_000)
  const [monthly, setMonthly] = useState(0)
  const [horizonYears, setHorizonYears] = useState(10)
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [stats, setStats] = useState<PortfolioStats | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [showMC, setShowMC] = useState(true)

  // Hydrate from LS / URL on mount
  useEffect(() => {
    const qProfile = getProfileFromQuery()
    const lsProfile = getProfileFromLS()
    const resolved = qProfile ?? lsProfile
    setProfile(resolved)
    setHydrated(true)
  }, [])

  // Run optimizer when objective / includeBelowFloor / profile changes
  const runOptimizer = useCallback(() => {
    const opts: OptimizerOpts = { includeBelowFloor, floor: 0.12 }
    try {
      let result: ReturnType<typeof maxSharpe>
      if (objective === 'maxSharpe') result = maxSharpe(assets, corr, opts)
      else if (objective === 'minVariance') result = minVariance(assets, corr, opts)
      else result = riskParity(assets, corr, opts)

      setWeights(allocToWeights(result.allocation))
      setStats(result.stats)
    } catch {
      // No eligible assets — show empty state
      setWeights({})
      setStats(null)
    }
  }, [objective, includeBelowFloor])

  useEffect(() => {
    if (hydrated) runOptimizer()
  }, [hydrated, runOptimizer])

  // Recompute stats when weights change manually
  const liveStats = useMemo(() => {
    if (Object.keys(weights).length === 0) return stats
    return computeStatsFromWeights(weights, assets)
  }, [weights, stats])

  // Below-floor assets for honesty panel
  const belowFloorAssets = useMemo(() => flagBelowFloor(assets), [])

  // Projection data
  const scenarioData = useMemo(() => {
    if (!liveStats) return []
    return projectScenarios(
      startAmount,
      monthly,
      liveStats.expectedReturn,
      liveStats.volatility,
      horizonYears,
    )
  }, [startAmount, monthly, liveStats, horizonYears])

  const mcData = useMemo(() => {
    if (!liveStats) return []
    return monteCarlo(
      startAmount,
      monthly,
      liveStats.expectedReturn,
      liveStats.volatility,
      horizonYears,
    )
  }, [startAmount, monthly, liveStats, horizonYears])

  // Assets with non-zero weights
  const activeAssets = useMemo(() => {
    return assets
      .map((a) => ({ asset: a, weight: weights[a.id] ?? 0 }))
      .filter((x) => x.weight > 0.001)
      .sort((a, b) => b.weight - a.weight)
  }, [weights])

  // Normalise weights after slider change
  function onWeightChange(assetId: string, newWeight: number) {
    const next = { ...weights, [assetId]: newWeight }
    // Renormalise
    const sum = Object.values(next).reduce((s, w) => s + w, 0)
    const normed: Record<string, number> = {}
    for (const [k, v] of Object.entries(next)) {
      normed[k] = sum > 0 ? v / sum : 0
    }
    setWeights(normed)
  }

  // P2P in current allocation
  const hasP2P = (weights['p2p-lending'] ?? 0) > 0.001
  const hasBelowFloor = includeBelowFloor && activeAssets.some((x) => x.asset.belowFloor)

  if (!hydrated) {
    return <div className="studio-loading mono">Loading studio...</div>
  }

  return (
    <div className="studio">
      {/* Controls */}
      <section className="studio-controls spine">
        <div className="ctrl-grid">
          {/* Left: financial inputs */}
          <div className="ctrl-col">
            <h2 className="ctrl-h mono">Portfolio inputs</h2>
            <div className="ctrl-fields">
              <FieldNum
                label="Start amount (₹)"
                value={startAmount}
                min={0}
                step={50000}
                format={(v) => inr(v)}
                onChange={setStartAmount}
              />
              <FieldNum
                label="Monthly SIP (₹)"
                value={monthly}
                min={0}
                step={1000}
                format={(v) => inr(v)}
                onChange={setMonthly}
              />
              <FieldNum
                label="Horizon (years)"
                value={horizonYears}
                min={1}
                max={40}
                step={1}
                format={(v) => String(v)}
                onChange={setHorizonYears}
              />
            </div>
          </div>

          {/* Right: optimizer controls */}
          <div className="ctrl-col">
            <h2 className="ctrl-h mono">Optimizer</h2>
            <div className="ctrl-fields">
              <div className="ctrl-field">
                <span className="ctrl-label mono">Objective</span>
                <fieldset className="seg-ctrl" aria-label="Objective">
                  <legend className="sr-only">Objective</legend>
                  {(Object.keys(OBJ_LABELS) as Objective[]).map((obj) => (
                    <button
                      key={obj}
                      type="button"
                      className={`seg-btn${objective === obj ? ' seg-active' : ''}`}
                      onClick={() => setObjective(obj)}
                      aria-pressed={objective === obj}
                    >
                      {OBJ_LABELS[obj]}
                    </button>
                  ))}
                </fieldset>
              </div>

              <div className="ctrl-field">
                <label className="ctrl-toggle">
                  <input
                    type="checkbox"
                    checked={includeBelowFloor}
                    onChange={(e) => setIncludeBelowFloor(e.target.checked)}
                  />
                  <span className="toggle-label">Include below-12% assets</span>
                </label>
                <p className="ctrl-hint mono">
                  Off = optimizer excludes intl-equity, gold, REITs, P2P, arbitrage, corp-bond
                </p>
              </div>

              <button type="button" className="btn-reopt mono" onClick={runOptimizer}>
                Re-run optimizer
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats hero */}
      {liveStats && (
        <section className="studio-stats spine">
          <div className="stats-row">
            <StatCard label={`Profile: ${profile}`} value={OBJ_LABELS[objective]} />
            <StatCard label="Expected return" value={pct(liveStats.expectedReturn)} accent />
            <StatCard label="Volatility (1σ)" value={pct(liveStats.volatility)} />
            <StatCard label="Sharpe ratio" value={liveStats.sharpe.toFixed(2)} accent />
            {scenarioData.length > 0 && (
              <StatCard
                label={`Base corpus (${horizonYears}y)`}
                value={compactInr(scenarioData[scenarioData.length - 1].base)}
              />
            )}
          </div>
        </section>
      )}

      {/* Allocation display */}
      <section className="studio-alloc spine">
        <h2 className="section-h mono">Allocation</h2>

        {/* Stacked bar */}
        {activeAssets.length > 0 && (
          <div className="stacked-bar" aria-label="Portfolio allocation" role="img">
            {activeAssets.map((x) => (
              <div
                key={x.asset.id}
                className={`stacked-seg${x.asset.belowFloor ? ' seg-below' : ''}`}
                style={{ width: `${(x.weight * 100).toFixed(1)}%` }}
                title={`${x.asset.name}: ${pct(x.weight, 1)}`}
              />
            ))}
          </div>
        )}

        {/* Allocation table + sliders */}
        <div className="alloc-table-wrap">
          <table className="alloc-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Sleeve</th>
                <th>Fwd ret</th>
                <th>Weight</th>
                <th>Adjust</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const w = weights[a.id] ?? 0
                const isActive = w > 0.001
                return (
                  <tr
                    key={a.id}
                    className={`${!isActive ? 'row-zero' : ''} ${a.belowFloor ? 'row-below' : ''}`}
                  >
                    <td>
                      <a href={`/assets/${a.id}/`} className="asset-link">
                        {a.name}
                      </a>
                      {a.belowFloor && <span className="below-badge mono loss">below 12%</span>}
                      {a.id === 'p2p-lending' && (
                        <span className="p2p-badge mono loss">P2P risk</span>
                      )}
                    </td>
                    <td className="mono sleeve-cell">{a.sleeve}</td>
                    <td className={`num ${a.belowFloor ? 'loss' : 'gain'}`}>
                      {pct(a.expectedReturn)}
                    </td>
                    <td className="num weight-cell">{pct(w, 1)}</td>
                    <td className="slider-cell">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(w * 100)}
                        onChange={(e) => onWeightChange(a.id, Number(e.target.value) / 100)}
                        aria-label={`Weight for ${a.name}`}
                        className="alloc-slider"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* P2P warning */}
        {hasP2P && (
          <div className="p2p-warning" role="alert">
            <p className="p2p-warn-text mono loss">
              P2P lending included at{' '}
              <span className="num">{pct(weights['p2p-lending'] ?? 0, 1)}</span>. Advertised 10-18%
              is gross/pre-default. RBI (Aug-2024) banned assured returns. Realistic net ~6-10%.
              Lender bears 100% default loss. No deposit guarantee.
            </p>
          </div>
        )}

        {/* Manual weights caveat */}
        {hasBelowFloor && (
          <div className="below-warning" role="alert">
            <p className="mono">
              Below-floor assets included. Optimizer is not optimised for these — consider their
              drag on Sharpe.
            </p>
          </div>
        )}
      </section>

      {/* Projection chart */}
      {scenarioData.length > 0 && liveStats && (
        <section className="studio-proj spine">
          <div className="proj-header">
            <h2 className="section-h mono">Wealth projection</h2>
            <label className="ctrl-toggle mc-toggle">
              <input
                type="checkbox"
                checked={showMC}
                onChange={(e) => setShowMC(e.target.checked)}
              />
              <span className="toggle-label mono">Show Monte Carlo</span>
            </label>
          </div>
          <div className="proj-meta mono">
            Start: <span className="num">{inr(startAmount)}</span>
            {monthly > 0 && (
              <>
                {' '}
                &middot; SIP: <span className="num">{inr(monthly)}/mo</span>
              </>
            )}
            &middot; Horizon: <span className="num">{horizonYears}y</span>
            &middot; <span className="num">{pct(liveStats.expectedReturn)}</span> base return
          </div>
          <ProjectionChart scenarios={scenarioData} mc={mcData} showMC={showMC} />
        </section>
      )}

      {/* Honesty panel */}
      <section className="studio-honesty spine">
        <HonestyPanel belowFloor={belowFloorAssets} />
      </section>

      <style>{studioStyles}</style>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat-card">
      <span className="stat-label mono">{label}</span>
      <span className={`stat-val num${accent ? ' stat-accent' : ''}`}>{value}</span>
    </div>
  )
}

interface FieldNumProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  format: (v: number) => string
  onChange: (v: number) => void
}

function FieldNum({ label, value, min = 0, max, step = 1, onChange }: FieldNumProps) {
  return (
    <label className="ctrl-field">
      <span className="ctrl-label mono">{label}</span>
      <input
        type="number"
        className="num ctrl-input"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v >= (min ?? 0)) onChange(v)
        }}
      />
    </label>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const studioStyles = `
.studio {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.studio-loading {
  padding: 3rem 2rem;
  color: var(--ink-mute);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

/* Controls */
.studio-controls {
  padding-block: 2rem;
  border-bottom: 1px solid var(--rule);
}
.ctrl-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}
@media (min-width: 760px) {
  .ctrl-grid { grid-template-columns: 1fr 1fr; gap: 2.5rem; }
}
.ctrl-h {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-mute);
  font-weight: 500;
  margin: 0 0 1.25rem;
}
.ctrl-fields { display: flex; flex-direction: column; gap: 1rem; }
.ctrl-field { display: flex; flex-direction: column; gap: 0.375rem; }
.ctrl-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-mute);
  font-weight: 500;
}
.ctrl-input {
  height: 40px;
  padding: 0 0.75rem;
  background: var(--paper);
  border: 1px solid var(--rule);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 16px;
  text-align: right;
  font-feature-settings: 'tnum' 1, 'zero' 1, 'calt' 0;
  width: 100%;
}
.ctrl-input:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
  border-color: var(--accent);
}
.ctrl-hint {
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--ink-mute);
  margin: 0;
}

/* Segmented control */
.seg-ctrl {
  display: flex;
  border: 1px solid var(--rule);
  overflow: hidden;
  padding: 0;
  margin: 0;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
.seg-btn {
  flex: 1;
  height: 36px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--rule);
  color: var(--ink-mute);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.seg-btn:last-child { border-right: none; }
.seg-active {
  background: var(--accent);
  color: var(--paper);
}
.seg-btn:hover:not(.seg-active) {
  background: color-mix(in oklab, var(--accent) 8%, transparent);
  color: var(--accent);
}

/* Toggle */
.ctrl-toggle {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
}
.toggle-label {
  font-size: 0.9375rem;
  color: var(--ink);
}

.btn-reopt {
  align-self: flex-start;
  height: 40px;
  padding-inline: 1.25rem;
  background: transparent;
  border: 1px solid var(--rule);
  color: var(--ink-mute);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s;
}
.btn-reopt:hover { border-color: var(--accent); color: var(--accent); }

/* Stats */
.studio-stats {
  padding-block: 1.5rem;
  border-bottom: 1px solid var(--rule);
}
.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--rule);
  background: var(--paper);
  min-width: 140px;
}
.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ink-mute);
}
.stat-val {
  font-size: 1.625rem;
  font-weight: 500;
  color: var(--ink);
  font-family: var(--font-mono);
  font-feature-settings: 'tnum' 1, 'zero' 1;
  line-height: 1.1;
}
.stat-accent { color: var(--accent); }

/* Allocation */
.studio-alloc {
  padding-block: 2rem;
  border-bottom: 1px solid var(--rule);
}
.section-h {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-mute);
  font-weight: 500;
  margin: 0 0 1.25rem;
}
.stacked-bar {
  display: flex;
  height: 24px;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--rule);
  margin-bottom: 1.5rem;
  gap: 1px;
  background: var(--rule);
}
.stacked-seg {
  background: var(--accent);
  transition: width 0.3s ease;
}
.stacked-seg:nth-child(2) { background: color-mix(in oklab, var(--accent) 75%, var(--gain)); }
.stacked-seg:nth-child(3) { background: color-mix(in oklab, var(--accent) 55%, var(--gain)); }
.stacked-seg:nth-child(4) { background: color-mix(in oklab, var(--accent) 40%, var(--gain)); }
.stacked-seg:nth-child(5) { background: color-mix(in oklab, var(--accent) 25%, var(--gain)); }
.stacked-seg:nth-child(n+6) { background: var(--ink-mute); }
.seg-below { background: color-mix(in oklab, var(--ink-mute) 60%, var(--rule) 40%) !important; }

.alloc-table-wrap { overflow-x: auto; }
.alloc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.alloc-table thead th {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-mute);
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--rule);
  text-align: left;
}
.alloc-table thead th:nth-child(3),
.alloc-table thead th:nth-child(4) { text-align: right; }
.alloc-table tbody td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid color-mix(in oklab, var(--rule) 40%, transparent);
  color: var(--ink);
  vertical-align: middle;
}
.row-zero { opacity: 0.4; }
.row-below td { background: color-mix(in oklab, var(--loss) 4%, transparent); }
.asset-link {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: color-mix(in oklab, var(--rule) 80%, transparent);
}
.asset-link:hover { color: var(--accent); text-decoration-color: var(--accent); }
.below-badge, .p2p-badge {
  display: inline-block;
  margin-left: 0.5rem;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.1em 0.375em;
  border: 1px solid currentColor;
  vertical-align: middle;
}
.sleeve-cell {
  font-size: 11px;
  color: var(--ink-mute);
  white-space: nowrap;
}
.weight-cell {
  font-family: var(--font-mono);
  font-feature-settings: 'tnum' 1;
  text-align: right;
  min-width: 56px;
}
.gain { color: var(--gain); }
.loss { color: var(--loss); }
.num {
  font-family: var(--font-mono);
  font-feature-settings: 'tnum' 1, 'zero' 1, 'calt' 0;
  font-variant-numeric: tabular-nums slashed-zero;
}
.slider-cell { min-width: 120px; }
.alloc-slider {
  accent-color: var(--accent);
  width: 100%;
  cursor: pointer;
}

.p2p-warning, .below-warning {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--loss);
  background: color-mix(in oklab, var(--loss) 8%, transparent);
}
.below-warning {
  border-color: var(--rule);
  background: color-mix(in oklab, var(--rule) 20%, transparent);
}
.p2p-warn-text {
  font-size: 12px;
  letter-spacing: 0.04em;
  margin: 0;
}
.below-warning p {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--ink-mute);
  margin: 0;
}

/* Projection */
.studio-proj {
  padding-block: 2rem;
  border-bottom: 1px solid var(--rule);
}
.proj-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.mc-toggle .toggle-label { font-size: 13px; }
.proj-meta {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-mute);
  margin-bottom: 1rem;
}

/* Honesty */
.studio-honesty {
  padding-block: 2rem 3rem;
}
`
