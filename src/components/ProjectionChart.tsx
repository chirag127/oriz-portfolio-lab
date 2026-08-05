/**
 * ProjectionChart — recharts area/line chart for scenario bands + Monte Carlo cone.
 * Pure presentational; all data passed as props.
 */
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { compactInr } from '~/lib/format'

export interface ScenarioPoint {
  year: number
  bear: number
  base: number
  bull: number
}

export interface MCPoint {
  year: number
  p10: number
  p50: number
  p90: number
}

interface Props {
  scenarios: ScenarioPoint[]
  mc: MCPoint[]
  showMC?: boolean
}

// Merge scenario + MC data by year
function mergeData(scenarios: ScenarioPoint[], mc: MCPoint[]) {
  return scenarios.map((s) => {
    const m = mc.find((p) => p.year === s.year)
    return {
      year: s.year,
      bear: Math.round(s.bear),
      base: Math.round(s.base),
      bull: Math.round(s.bull),
      p10: m ? Math.round(m.p10) : undefined,
      p50: m ? Math.round(m.p50) : undefined,
      p90: m ? Math.round(m.p90) : undefined,
    }
  })
}

function formatY(v: number) {
  return compactInr(v)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="ct-year mono">Year {label}</p>
      {payload.map((p) => (
        <p key={p.name} className="ct-row mono" style={{ color: p.color }}>
          {p.name}: {compactInr(p.value)}
        </p>
      ))}
      <style>{`
        .chart-tooltip {
          background: var(--paper);
          border: 1px solid var(--rule);
          padding: 0.75rem 1rem;
          font-size: 12px;
        }
        .ct-year {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--ink-mute);
          margin: 0 0 0.375rem;
        }
        .ct-row {
          margin: 0.125rem 0;
          font-feature-settings: 'tnum' 1;
        }
      `}</style>
    </div>
  )
}

export default function ProjectionChart({ scenarios, mc, showMC = true }: Props) {
  const data = mergeData(scenarios, mc)

  // Frontier teal + amber plot + coral flag palette (hardcoded hex as fallback since CSS vars aren't available in SVG attributes)
  const COBALT = '#34E0C4'
  const GAIN = '#34E0C4'
  const LOSS = '#FF6B6B'
  const MUTED = '#8B98AD'
  const PLOT = '#F5B841'

  return (
    <div className="proj-chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="scenBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COBALT} stopOpacity={0.12} />
              <stop offset="95%" stopColor={COBALT} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={MUTED} stopOpacity={0.1} />
              <stop offset="95%" stopColor={MUTED} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--rule, #d8dae0)" strokeOpacity={0.6} />
          <XAxis
            dataKey="year"
            tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'Year',
              position: 'insideBottomRight',
              offset: -4,
              fontSize: 11,
              fill: MUTED,
            }}
          />
          <YAxis
            tickFormatter={formatY}
            tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="line"
            wrapperStyle={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, paddingTop: 8 }}
          />

          {/* Bear-bull scenario band */}
          <Area
            type="monotone"
            dataKey="bull"
            stroke="none"
            fill="url(#scenBand)"
            name="Bull"
            dot={false}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="bear"
            stroke="none"
            fill={LOSS}
            fillOpacity={0.06}
            name="Bear"
            dot={false}
            legendType="none"
            baseValue={0}
          />

          {/* Base line — cobalt */}
          <Line
            type="monotone"
            dataKey="base"
            stroke={COBALT}
            strokeWidth={2.5}
            dot={false}
            name="Base"
            activeDot={{ r: 4, fill: COBALT }}
          />

          {/* Bear and bull scenario lines */}
          <Line
            type="monotone"
            dataKey="bull"
            stroke={PLOT}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 3"
            name="Bull"
          />
          <Line
            type="monotone"
            dataKey="bear"
            stroke={LOSS}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 3"
            name="Bear"
          />

          {/* Monte Carlo percentile cone */}
          {showMC && (
            <>
              <Line
                type="monotone"
                dataKey="p90"
                stroke={MUTED}
                strokeWidth={1}
                dot={false}
                strokeDasharray="2 4"
                name="MC p90"
              />
              <Line
                type="monotone"
                dataKey="p50"
                stroke={MUTED}
                strokeWidth={1.5}
                dot={false}
                name="MC p50"
              />
              <Line
                type="monotone"
                dataKey="p10"
                stroke={MUTED}
                strokeWidth={1}
                dot={false}
                strokeDasharray="2 4"
                name="MC p10"
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="proj-caveat mono">
        Estimates only. Bear = expected − vol; Bull = expected + vol. Monte Carlo: 1,000 paths
        Normal(μ,σ). Markets can and do fall 40-60%.
      </p>
      <style>{`
        .proj-chart-wrap { width: 100%; }
        .proj-caveat {
          margin: 0.5rem 0 0;
          font-size: 10px;
          letter-spacing: 0.06em;
          color: var(--ink-mute);
          text-transform: uppercase;
        }
      `}</style>
    </div>
  )
}
