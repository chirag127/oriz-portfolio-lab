import { describe, expect, it } from 'vitest'
import type { RiskProfile } from '../questionnaire.js'
import { QUESTIONS, scoreAnswers, seedAllocationFor } from '../questionnaire.js'

const ALL_PROFILES: RiskProfile[] = ['conservative', 'balanced', 'growth', 'aggressive']

function sumWeights(seed: Partial<Record<string, number>>): number {
  return Object.values(seed).reduce((s: number, v) => s + (v ?? 0), 0)
}

describe('QUESTIONS', () => {
  it('has 10-14 questions', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(10)
    expect(QUESTIONS.length).toBeLessThanOrEqual(14)
  })

  it('each question has at least 2 options', () => {
    QUESTIONS.forEach((q) => {
      expect(q.options.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('all question ids are unique', () => {
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('scoreAnswers', () => {
  it('all-max -> aggressive', () => {
    const maxAnswers: Record<string, number> = {}
    QUESTIONS.forEach((q) => {
      maxAnswers[q.id] = Math.max(...q.options.map((o) => o.score))
    })
    const { profile } = scoreAnswers(maxAnswers)
    expect(profile).toBe('aggressive')
  })

  it('all-min -> conservative', () => {
    const minAnswers: Record<string, number> = {}
    QUESTIONS.forEach((q) => {
      minAnswers[q.id] = Math.min(...q.options.map((o) => o.score))
    })
    const { profile } = scoreAnswers(minAnswers)
    expect(profile).toBe('conservative')
  })

  it('riskScore in [0,100]', () => {
    const midAnswers: Record<string, number> = {}
    QUESTIONS.forEach((q) => {
      const scores = q.options.map((o) => o.score)
      midAnswers[q.id] = scores[Math.floor(scores.length / 2)]
    })
    const { riskScore } = scoreAnswers(midAnswers)
    expect(riskScore).toBeGreaterThanOrEqual(0)
    expect(riskScore).toBeLessThanOrEqual(100)
  })
})

describe('seedAllocationFor', () => {
  ALL_PROFILES.forEach((profile) => {
    it(`${profile} seed sums to ~1`, () => {
      const seed = seedAllocationFor(profile)
      expect(sumWeights(seed)).toBeCloseTo(1, 9)
    })
  })

  it('aggressive has more equity than conservative', () => {
    const agg = seedAllocationFor('aggressive')
    const con = seedAllocationFor('conservative')
    const aggEq = (agg['indian-equity'] ?? 0) + (agg['intl-equity'] ?? 0)
    const conEq = (con['indian-equity'] ?? 0) + (con['intl-equity'] ?? 0)
    expect(aggEq).toBeGreaterThan(conEq)
  })

  it('conservative has more defensive sleeves than aggressive', () => {
    const agg = seedAllocationFor('aggressive')
    const con = seedAllocationFor('conservative')
    const aggDef = (agg.gold ?? 0) + (agg.arbitrage ?? 0)
    const conDef = (con.gold ?? 0) + (con.arbitrage ?? 0)
    expect(conDef).toBeGreaterThan(aggDef)
  })
})
