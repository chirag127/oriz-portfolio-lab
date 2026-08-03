/**
 * Guided questionnaire engine — pure logic, no UI.
 * Produces a risk score, a profile label, and a sleeve-weight seed
 * that the optimizer refines subject to the 12% floor.
 */

import type { Sleeve } from './types.js'

// ---------------------------------------------------------------------------
// Question schema
// ---------------------------------------------------------------------------

export interface QuestionOption {
  label: string
  value: string
  score: number
}

export interface Question {
  id: string
  prompt: string
  help?: string
  options: QuestionOption[]
}

export type RiskProfile = 'conservative' | 'balanced' | 'growth' | 'aggressive'

// ---------------------------------------------------------------------------
// Questions (10-14, India retail context)
// ---------------------------------------------------------------------------

export const QUESTIONS: Question[] = [
  {
    id: 'horizon',
    prompt: 'Investment horizon?',
    help: 'Longer horizon tolerates more volatility.',
    options: [
      { label: 'Under 2 years', value: 'lt2', score: 0 },
      { label: '2–5 years', value: '2to5', score: 25 },
      { label: '5–10 years', value: '5to10', score: 60 },
      { label: 'Over 10 years', value: 'gt10', score: 100 },
    ],
  },
  {
    id: 'age_band',
    prompt: 'Age band?',
    help: 'Younger investors can absorb more risk.',
    options: [
      { label: '55+', value: 'senior', score: 0 },
      { label: '45–54', value: 'mid_senior', score: 25 },
      { label: '35–44', value: 'mid', score: 60 },
      { label: 'Under 35', value: 'young', score: 100 },
    ],
  },
  {
    id: 'income_stability',
    prompt: 'Income stability?',
    options: [
      { label: 'Retired / no income', value: 'none', score: 0 },
      { label: 'Self-employed / variable', value: 'variable', score: 30 },
      { label: 'Salaried, single earner', value: 'salaried_single', score: 60 },
      { label: 'Salaried, dual household income', value: 'salaried_dual', score: 100 },
    ],
  },
  {
    id: 'emergency_fund',
    prompt: 'Emergency fund status?',
    help: '6 months expenses liquid before investing in volatile assets.',
    options: [
      { label: 'None', value: 'none', score: 0 },
      { label: '1–3 months', value: 'partial', score: 30 },
      { label: '3–6 months', value: 'adequate', score: 70 },
      { label: '6+ months', value: 'strong', score: 100 },
    ],
  },
  {
    id: 'max_drawdown',
    prompt: 'Max tolerable 1-year portfolio loss?',
    options: [
      { label: 'Up to 5%', value: 'lt5', score: 0 },
      { label: 'Up to 15%', value: 'lt15', score: 30 },
      { label: 'Up to 30%', value: 'lt30', score: 65 },
      { label: 'Over 30%', value: 'gt30', score: 100 },
    ],
  },
  {
    id: 'crash_reaction',
    prompt: 'Market drops 30% in 3 months. You:',
    options: [
      { label: 'Sell everything', value: 'sell', score: 0 },
      { label: 'Reduce equity exposure', value: 'reduce', score: 25 },
      { label: 'Hold steady', value: 'hold', score: 70 },
      { label: 'Buy more (opportunity)', value: 'buy', score: 100 },
    ],
  },
  {
    id: 'goal',
    prompt: 'Primary investment goal?',
    options: [
      { label: 'Capital preservation', value: 'preservation', score: 0 },
      { label: 'Steady income', value: 'income', score: 25 },
      { label: 'Balanced growth + income', value: 'balanced', score: 60 },
      { label: 'Long-term wealth creation', value: 'wealth', score: 100 },
    ],
  },
  {
    id: 'liquidity',
    prompt: 'Liquidity needs from this portfolio?',
    options: [
      { label: 'May need within 6 months', value: 'high', score: 0 },
      { label: 'Within 1–2 years', value: 'medium', score: 30 },
      { label: 'Not for 3+ years', value: 'low', score: 70 },
      { label: 'Fully illiquid OK', value: 'none', score: 100 },
    ],
  },
  {
    id: 'p2p_comfort',
    prompt: 'Comfort with P2P lending (default risk, no SEBI protection)?',
    help: 'P2P replaces traditional debt in this framework.',
    options: [
      { label: 'Not comfortable', value: 'no', score: 0 },
      { label: 'Small allocation ok (< 5%)', value: 'small', score: 30 },
      { label: 'Moderate (5–15%)', value: 'moderate', score: 65 },
      { label: 'High (>15%)', value: 'high', score: 100 },
    ],
  },
  {
    id: 'intl_appetite',
    prompt: 'Appetite for international equity exposure?',
    help: 'Adds currency risk + diversification.',
    options: [
      { label: 'None — India only', value: 'none', score: 0 },
      { label: 'Small (up to 10%)', value: 'small', score: 30 },
      { label: 'Moderate (10–25%)', value: 'moderate', score: 65 },
      { label: 'High (25%+)', value: 'high', score: 100 },
    ],
  },
  {
    id: 'experience',
    prompt: 'Prior investing experience?',
    options: [
      { label: 'None — first investment', value: 'none', score: 0 },
      { label: 'FD / PPF only', value: 'fd', score: 20 },
      { label: 'Mutual funds for 2+ years', value: 'mf', score: 60 },
      { label: 'Direct equity / multi-asset', value: 'direct', score: 100 },
    ],
  },
  {
    id: 'monthly_sip',
    prompt: 'Monthly SIP capacity?',
    options: [
      { label: 'Under ₹5,000', value: 'lt5k', score: 10 },
      { label: '₹5,000–₹20,000', value: '5to20k', score: 40 },
      { label: '₹20,000–₹50,000', value: '20to50k', score: 70 },
      { label: 'Over ₹50,000', value: 'gt50k', score: 100 },
    ],
  },
  {
    id: 'lumpsum',
    prompt: 'Lump-sum amount available now?',
    options: [
      { label: 'Under ₹1L', value: 'lt1l', score: 10 },
      { label: '₹1L–₹5L', value: '1to5l', score: 35 },
      { label: '₹5L–₹20L', value: '5to20l', score: 65 },
      { label: 'Over ₹20L', value: 'gt20l', score: 100 },
    ],
  },
  {
    id: 'esg',
    prompt: 'ESG / exclusion preference?',
    options: [
      { label: 'No preference', value: 'none', score: 50 },
      { label: 'Avoid sin sectors', value: 'light', score: 50 },
      { label: 'Prefer ESG-rated funds', value: 'esg', score: 50 },
      { label: 'Strict exclusion list', value: 'strict', score: 50 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Scores from options are raw 0-100; average them. Profile is banded. */
export function scoreAnswers(answers: Record<string, number>): {
  riskScore: number
  profile: RiskProfile
} {
  const ids = QUESTIONS.map((q) => q.id)
  const scores = ids.map((id) => answers[id] ?? 0)
  const riskScore = scores.reduce((s, v) => s + v, 0) / scores.length

  let profile: RiskProfile
  if (riskScore < 25) profile = 'conservative'
  else if (riskScore < 50) profile = 'balanced'
  else if (riskScore < 75) profile = 'growth'
  else profile = 'aggressive'

  return { riskScore, profile }
}

// ---------------------------------------------------------------------------
// Seed allocations
// ---------------------------------------------------------------------------

/**
 * Starting sleeve weights per profile.
 * The optimizer refines these subject to the 12% return floor.
 * All weights sum to 1.
 */
export function seedAllocationFor(profile: RiskProfile): Partial<Record<Sleeve, number>> {
  switch (profile) {
    case 'conservative':
      return {
        'indian-equity': 0.1,
        'intl-equity': 0.0,
        gold: 0.2,
        'reits-invits': 0.2,
        'p2p-lending': 0.05,
        arbitrage: 0.25,
        'debt-alt': 0.2,
      }
    case 'balanced':
      return {
        'indian-equity': 0.25,
        'intl-equity': 0.1,
        gold: 0.15,
        'reits-invits': 0.15,
        'p2p-lending': 0.1,
        arbitrage: 0.15,
        'debt-alt': 0.1,
      }
    case 'growth':
      return {
        'indian-equity': 0.35,
        'intl-equity': 0.2,
        gold: 0.1,
        'reits-invits': 0.1,
        'p2p-lending': 0.15,
        arbitrage: 0.05,
        'debt-alt': 0.05,
      }
    case 'aggressive':
      return {
        'indian-equity': 0.45,
        'intl-equity': 0.3,
        gold: 0.05,
        'reits-invits': 0.05,
        'p2p-lending': 0.15,
        arbitrage: 0.0,
        'debt-alt': 0.0,
      }
  }
}
