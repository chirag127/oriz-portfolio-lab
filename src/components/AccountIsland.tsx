/**
 * AccountIsland — Clerk sign-in/out for portfolio-lab. Public-first: the whole
 * site works signed-out; Clerk gates only personal features (saving portfolios
 * to sync across devices). Cross-subdomain SSO across *.oriz.in.
 *
 * Publishable key from PUBLIC_CLERK_PUBLISHABLE_KEY (never hardcoded). When the
 * key is absent the island renders a quiet notice instead of throwing.
 */
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useUser,
} from '@clerk/clerk-react'

const PUB_KEY = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY

const clerkAppearance = {
  variables: {
    colorPrimary: '#34e0c4',
    colorBackground: '#0f1727',
    colorText: '#e6ecf5',
    colorInputBackground: '#0b1220',
    colorInputText: '#e6ecf5',
    borderRadius: '8px',
    fontFamily: 'Sora, system-ui, sans-serif',
  },
}

function Identity() {
  const { user } = useUser()
  const name = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || 'you'
  return (
    <div className="acct-me">
      <div className="acct-me-text">
        <span className="acct-label mono">Signed in</span>
        <span className="acct-name">{name}</span>
        <span className="acct-note mono">
          Portfolios you save now sync to your account across every oriz.in tool.
        </span>
      </div>
      <UserButton afterSignOutUrl="/account/" />
    </div>
  )
}

export default function AccountIsland() {
  if (!PUB_KEY) {
    return (
      <div className="acct-panel acct-unconfigured">
        <span className="acct-label mono">Accounts offline</span>
        <p className="acct-note">
          Sign-in isn't configured in this build. Every tool still works — your
          portfolios stay in this browser.
        </p>
      </div>
    )
  }

  return (
    <ClerkProvider
      publishableKey={PUB_KEY}
      appearance={clerkAppearance}
      afterSignOutUrl="/account/"
    >
      <SignedOut>
        <div className="acct-panel">
          <span className="acct-label mono">Optional</span>
          <h2 className="acct-h">Save your allocations</h2>
          <p className="acct-note">
            The studio is fully public — no account needed to build or project a
            portfolio. Sign in only to save allocations and pick them back up on
            another device. One login works across every oriz.in tool.
          </p>
          <div className="acct-clerk">
            <SignIn routing="hash" />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="acct-panel">
          <Identity />
        </div>
      </SignedIn>
      <style>{styles}</style>
    </ClerkProvider>
  )
}

const styles = `
.acct-panel {
  background: color-mix(in oklab, var(--panel) 90%, transparent);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 1.75rem;
}
.acct-unconfigured { border-style: dashed; }
.acct-label {
  display: inline-block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--frontier);
  margin-bottom: 0.6rem;
}
.acct-h {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.4rem;
  color: var(--ink);
  margin: 0 0 0.6rem;
}
.acct-note {
  color: var(--ink-mute);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0 0 1.25rem;
  max-width: 60ch;
}
.acct-clerk { margin-top: 0.5rem; }
.acct-me { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.25rem; }
.acct-me-text { display: flex; flex-direction: column; gap: 0.3rem; }
.acct-name { font-family: var(--font-display); font-weight: 600; font-size: 1.25rem; color: var(--ink); }
`
