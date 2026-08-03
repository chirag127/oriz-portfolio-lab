/**
 * Questionnaire — multi-step risk profile wizard.
 * Calls scoreAnswers() + seedAllocationFor() from questionnaire.ts.
 * Persists answers + profile to localStorage for the studio to read.
 */
import { useEffect, useState } from 'react'
import type { RiskProfile } from '~/lib/questionnaire'
import { QUESTIONS, scoreAnswers } from '~/lib/questionnaire'

const LS_KEY = 'oriz:portfolio-lab:questionnaire'

interface Saved {
  answers: Record<string, number>
  profile: RiskProfile
  riskScore: number
}

const PROFILE_LABEL: Record<RiskProfile, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  growth: 'Growth',
  aggressive: 'Aggressive',
}

const PROFILE_DESC: Record<RiskProfile, string> = {
  conservative:
    'Capital preservation focus. Low equity, high ballast. Better suited for short horizons or limited drawdown tolerance.',
  balanced:
    'Mix of growth and stability. Moderate equity with diversifying sleeves. Appropriate for 5+ year horizons.',
  growth:
    'Equity-led. Accepts 30-40% drawdowns for higher long-run return. 7+ year horizon recommended.',
  aggressive:
    'Maximum equity, accepts 40-60% drawdowns. Only for 10+ year horizons with high income stability.',
}

export default function Questionnaire() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<{ riskScore: number; profile: RiskProfile } | null>(null)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Saved
        setAnswers(saved.answers)
        setResult({ riskScore: saved.riskScore, profile: saved.profile })
        setDone(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const question = QUESTIONS[step]
  const total = QUESTIONS.length
  const progress = done ? 100 : Math.round((step / total) * 100)

  function select(score: number) {
    const next = { ...answers, [question.id]: score }
    setAnswers(next)
    if (step < total - 1) {
      setStep(step + 1)
    } else {
      finish(next)
    }
  }

  function finish(final: Record<string, number>) {
    const scored = scoreAnswers(final)
    setResult(scored)
    setDone(true)
    try {
      const toSave: Saved = { answers: final, ...scored }
      window.localStorage.setItem(LS_KEY, JSON.stringify(toSave))
    } catch {
      /* storage unavailable */
    }
  }

  function restart() {
    setAnswers({})
    setStep(0)
    setDone(false)
    setResult(null)
    try {
      window.localStorage.removeItem(LS_KEY)
    } catch {
      /* ignore */
    }
  }

  if (done && result) {
    return (
      <div className="q-done">
        <div className="q-profile-card">
          <span className="q-label mono">Risk profile</span>
          <h2 className="q-profile-name">{PROFILE_LABEL[result.profile]}</h2>
          <p className="q-profile-desc">{PROFILE_DESC[result.profile]}</p>
          <div className="q-score-row">
            <span className="q-label mono">Risk score</span>
            <span className="q-score num">{result.riskScore.toFixed(0)}</span>
            <span className="q-score-max mono">/ 100</span>
          </div>
          <div className="q-score-bar" aria-hidden="true">
            <div className="q-score-fill" style={{ width: `${result.riskScore}%` }} />
          </div>
        </div>

        <div className="q-actions">
          <a href={`/portfolio/?profile=${result.profile}`} className="btn-primary">
            See my portfolio &rarr;
          </a>
          <button type="button" className="btn-ghost" onClick={restart}>
            Retake questionnaire
          </button>
        </div>

        <p className="q-caveat mono">
          Profile is a starting point — override any weight in the studio.
        </p>

        <style>{qStyles}</style>
      </div>
    )
  }

  if (!question) return null

  return (
    <div className="q-wrap">
      {/* Progress */}
      <div className="q-progress-bar" aria-hidden="true">
        <div className="q-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="q-progress-label mono">
        {step + 1} / {total}
      </p>

      {/* Question */}
      <div className="q-card">
        <span className="q-label mono">{question.id.replace(/_/g, ' ')}</span>
        <h2 className="q-prompt">{question.prompt}</h2>
        {question.help && <p className="q-help">{question.help}</p>}

        <ul className="q-options">
          {question.options.map((opt) => {
            const selected = answers[question.id] === opt.score
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  className={`q-option${selected ? ' q-option-selected' : ''}`}
                  onClick={() => select(opt.score)}
                  aria-pressed={selected}
                >
                  <span className="q-option-label">{opt.label}</span>
                  <span className="q-option-score num">{opt.score}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Nav */}
      <div className="q-nav">
        {step > 0 && (
          <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>
            &larr; Back
          </button>
        )}
      </div>

      <style>{qStyles}</style>
    </div>
  )
}

const qStyles = `
.q-wrap { display: flex; flex-direction: column; gap: 1.5rem; max-width: 600px; }
.q-progress-bar {
  height: 3px;
  background: var(--rule);
}
.q-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}
.q-progress-label {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-mute);
  margin: 0;
}
.q-card {
  padding: 1.75rem;
  border: 1px solid var(--rule);
  background: var(--paper);
}
.q-label {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-mute);
  margin-bottom: 0.5rem;
}
.q-prompt {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  line-height: 1.2;
  color: var(--ink);
  margin: 0 0 0.75rem;
}
.q-help {
  font-size: 0.875rem;
  color: var(--ink-mute);
  margin: 0 0 1.25rem;
  line-height: 1.55;
}
.q-options {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.q-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.875rem 1rem;
  background: transparent;
  border: 1px solid var(--rule);
  color: var(--ink);
  font-family: inherit;
  font-size: 0.9375rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
}
.q-option:hover, .q-option:focus-visible {
  border-color: var(--accent);
  outline: none;
}
.q-option-selected {
  border-color: var(--accent);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
  color: var(--accent);
}
.q-option-label { flex: 1; }
.q-option-score {
  font-size: 11px;
  color: var(--ink-mute);
  font-family: var(--font-mono);
  font-feature-settings: 'tnum' 1;
  margin-left: 0.75rem;
}
.q-option-selected .q-option-score { color: var(--accent); }

.q-nav {
  display: flex;
  gap: 0.75rem;
}

/* Done */
.q-done { display: flex; flex-direction: column; gap: 1.75rem; max-width: 480px; }
.q-profile-card {
  padding: 1.75rem;
  border: 1px solid var(--accent);
  background: color-mix(in oklab, var(--accent) 5%, transparent);
}
.q-profile-name {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  color: var(--ink);
  margin: 0 0 0.75rem;
}
.q-profile-desc {
  font-size: 0.9375rem;
  color: var(--ink-mute);
  line-height: 1.65;
  margin: 0 0 1.25rem;
}
.q-score-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.q-score {
  font-family: var(--font-mono);
  font-size: 2rem;
  font-weight: 500;
  color: var(--accent);
  font-feature-settings: 'tnum' 1, 'zero' 1;
  line-height: 1;
}
.q-score-max {
  font-size: 14px;
  color: var(--ink-mute);
}
.q-score-bar {
  height: 4px;
  background: var(--rule);
}
.q-score-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.5s ease;
}

.q-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.q-caveat {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--ink-mute);
  margin: 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  height: 48px;
  padding-inline: 1.75rem;
  background: var(--accent);
  color: var(--paper);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  border: 1px solid var(--accent);
  cursor: pointer;
}
.btn-primary:hover { background: var(--ink); border-color: var(--ink); }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding-inline: 1.25rem;
  background: transparent;
  color: var(--ink-mute);
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  border: 1px solid var(--rule);
  cursor: pointer;
}
.btn-ghost:hover { border-color: var(--ink); color: var(--ink); }
`
