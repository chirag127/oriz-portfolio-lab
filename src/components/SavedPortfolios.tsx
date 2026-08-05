/**
 * SavedPortfolios — personal feature gated by Clerk, backed by Firestore.
 * User data is keyed by the Clerk user id (users/{clerkId}/portfolios/{docId}).
 * Firebase is Firestore only — Clerk owns auth. Public-first: signed-out users
 * see a prompt, not a wall; the studio itself is unaffected.
 *
 * Rendered inside its own ClerkProvider so the studio island stays auth-free.
 */
import { ClerkProvider, SignInButton, SignedIn, SignedOut, useAuth, useUser } from '@clerk/clerk-react'
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { db, isFirebaseConfigured } from '~/lib/firebase'

const PUB_KEY = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY

export interface PortfolioSnapshot {
  objective: string
  weights: Record<string, number>
  expectedReturn: number
  volatility: number
  sharpe: number
  horizonYears: number
}

interface SavedDoc extends PortfolioSnapshot {
  id: string
  label: string
  savedAt?: number
}

interface Props {
  snapshot: PortfolioSnapshot | null
  onLoad?: (s: PortfolioSnapshot) => void
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function Inner({ snapshot, onLoad }: Props) {
  const { user } = useUser()
  const { isSignedIn } = useAuth()
  const [saved, setSaved] = useState<SavedDoc[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const configured = isFirebaseConfigured()

  const uid = user?.id ?? null

  const refresh = useCallback(async () => {
    const store = db()
    if (!store || !uid) return
    try {
      const col = collection(store, 'users', uid, 'portfolios')
      const snap = await getDocs(query(col, orderBy('savedAt', 'desc')))
      setSaved(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedDoc, 'id'>) })),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load saved portfolios.')
    }
  }, [uid])

  useEffect(() => {
    if (isSignedIn && configured) refresh()
  }, [isSignedIn, configured, refresh])

  async function save() {
    const store = db()
    if (!store || !uid || !snapshot) return
    setBusy(true)
    setErr(null)
    try {
      const col = collection(store, 'users', uid, 'portfolios')
      const label = `${snapshot.objective} · ${pct(snapshot.expectedReturn)} · Sharpe ${snapshot.sharpe.toFixed(2)}`
      await addDoc(col, { ...snapshot, label, savedAt: Date.now(), created: serverTimestamp() })
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    const store = db()
    if (!store || !uid) return
    setErr(null)
    try {
      await deleteDoc(doc(store, 'users', uid, 'portfolios', id))
      setSaved((s) => s.filter((x) => x.id !== id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.')
    }
  }

  if (!configured) {
    return (
      <p className="sp-note mono">
        Cloud save is offline in this build — your work stays in this browser.
      </p>
    )
  }

  return (
    <div className="sp">
      <SignedOut>
        <div className="sp-prompt">
          <span className="sp-label mono">Optional</span>
          <p className="sp-note">Sign in to save this allocation and reload it on any device.</p>
          <SignInButton mode="modal">
            <button type="button" className="sp-btn sp-btn-primary">Sign in to save</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="sp-actions">
          <span className="sp-label mono">Your portfolios</span>
          <button
            type="button"
            className="sp-btn sp-btn-primary"
            onClick={save}
            disabled={busy || !snapshot}
          >
            {busy ? 'Saving…' : 'Save current allocation'}
          </button>
        </div>

        {saved.length === 0 ? (
          <p className="sp-note mono">No saved portfolios yet. Save one to sync it across devices.</p>
        ) : (
          <ul className="sp-list">
            {saved.map((s) => (
              <li key={s.id} className="sp-item">
                <div className="sp-item-main">
                  <span className="sp-item-label">{s.label}</span>
                  <span className="sp-item-meta mono">
                    vol {pct(s.volatility)} · {s.horizonYears}y
                  </span>
                </div>
                <div className="sp-item-actions">
                  {onLoad && (
                    <button type="button" className="sp-btn" onClick={() => onLoad(s)}>Load</button>
                  )}
                  <button
                    type="button"
                    className="sp-btn sp-btn-ghost"
                    onClick={() => remove(s.id)}
                    aria-label={`Delete ${s.label}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SignedIn>

      {err && <p className="sp-err mono" role="alert">{err}</p>}
      <style>{styles}</style>
    </div>
  )
}

export default function SavedPortfolios(props: Props) {
  if (!PUB_KEY) {
    return (
      <p className="sp-note mono" style={{ color: 'var(--ink-mute)', fontSize: 12 }}>
        Cloud save is offline in this build — your work stays in this browser.
      </p>
    )
  }
  return (
    <ClerkProvider publishableKey={PUB_KEY} afterSignOutUrl="/portfolio/">
      <Inner {...props} />
    </ClerkProvider>
  )
}

const styles = `
.sp { display: flex; flex-direction: column; gap: 0.875rem; }
.sp-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--frontier); }
.sp-note { color: var(--ink-mute); font-size: 0.9rem; line-height: 1.55; margin: 0; }
.sp-prompt { display: flex; flex-direction: column; gap: 0.6rem; align-items: flex-start; }
.sp-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.sp-btn {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--ink);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.sp-btn:hover:not(:disabled) { border-color: var(--frontier); color: var(--frontier); }
.sp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sp-btn-primary { background: var(--frontier); color: var(--plane); border-color: var(--frontier); font-weight: 600; }
.sp-btn-primary:hover:not(:disabled) { background: var(--frontier-deep); border-color: var(--frontier-deep); color: var(--plane); }
.sp-btn-ghost:hover { border-color: var(--flag); color: var(--flag); }
.sp-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.sp-item {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.7rem 0.9rem; border: 1px solid var(--rule); border-radius: 8px;
  background: color-mix(in oklab, var(--panel) 70%, transparent);
}
.sp-item-main { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.sp-item-label { font-size: 0.9rem; color: var(--ink); font-weight: 500; }
.sp-item-meta { font-size: 11px; color: var(--ink-mute); }
.sp-item-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
.sp-err { color: var(--flag); font-size: 12px; margin: 0; }
`
