/**
 * HonestyPanel — reusable block listing below-floor assets + P2P red caveat.
 */

import { pct } from '~/lib/format'
import type { Asset } from '~/lib/types'

interface Props {
  belowFloor: Asset[]
  compact?: boolean
}

export default function HonestyPanel({ belowFloor, compact = false }: Props) {
  if (belowFloor.length === 0) return null

  return (
    <div
      className={`hp-wrap${compact ? ' hp-compact' : ''}`}
      role="alert"
      aria-label="Below-floor assets"
    >
      <p className="hp-title mono">These assets don't clear the 12% forward-return floor</p>
      <ul className="hp-list">
        {belowFloor.map((a) => {
          const isP2P = a.id === 'p2p-lending'
          return (
            <li key={a.id} className={`hp-item${isP2P ? ' hp-p2p' : ''}`}>
              <div className="hp-row">
                <span className="hp-name">
                  <a href={`/assets/${a.id}/`} className="hp-link">
                    {a.name}
                  </a>
                </span>
                <span className="hp-ret num loss">{pct(a.expectedReturn)} fwd</span>
              </div>
              {!compact && (
                <p className={`hp-notes${isP2P ? ' loss' : ''}`}>
                  {isP2P
                    ? 'CRITICAL: advertised 10-18% is gross/pre-default. RBI (Aug-2024) banned assured returns. Lender bears 100% default loss. No deposit guarantee. Illiquid. Net realistic ~6-10%.'
                    : a.riskNotes}
                </p>
              )}
              {isP2P && compact && (
                <p className="hp-notes loss">
                  P2P: gross/pre-default marketing. Realistic net ~6-10%.
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <style>{`
        .hp-wrap {
          padding: 1rem 1.25rem;
          border: 1px solid color-mix(in oklab, var(--loss) 40%, var(--rule) 60%);
          background: color-mix(in oklab, var(--loss) 5%, transparent);
        }
        .hp-compact {
          padding: 0.75rem 1rem;
        }
        .hp-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--loss);
          margin: 0 0 0.875rem;
        }
        .hp-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }
        .hp-item {
          padding-bottom: 0.75rem;
          border-bottom: 1px solid color-mix(in oklab, var(--rule) 50%, transparent);
        }
        .hp-item:last-child { border-bottom: 0; padding-bottom: 0; }
        .hp-p2p .hp-row { border-left: 2px solid var(--loss); padding-left: 0.75rem; }
        .hp-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.25rem;
        }
        .hp-name { font-weight: 600; font-size: 0.9375rem; color: var(--ink); }
        .hp-link { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
        .hp-link:hover { color: var(--accent); }
        .hp-ret {
          font-family: var(--font-mono);
          font-size: 13px;
          white-space: nowrap;
          font-feature-settings: 'tnum' 1;
        }
        .hp-notes {
          font-size: 12px;
          color: var(--ink-mute);
          line-height: 1.55;
          margin: 0;
          max-width: 68ch;
        }
        .hp-notes.loss { color: var(--loss); }
        .loss { color: var(--loss); }
      `}</style>
    </div>
  )
}
