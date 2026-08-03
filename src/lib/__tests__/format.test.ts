import { describe, expect, it } from 'vitest'
import { compactInr, inr, pct } from '../format.js'

describe('inr', () => {
  it('under 1000 has no comma', () => {
    expect(inr(999)).toBe('₹999')
  })

  it('1234 -> ₹1,234', () => {
    expect(inr(1234)).toBe('₹1,234')
  })

  it('12345 -> ₹12,345', () => {
    expect(inr(12345)).toBe('₹12,345')
  })

  it('1234567 -> ₹12,34,567', () => {
    expect(inr(1234567)).toBe('₹12,34,567')
  })

  it('12345678 -> ₹1,23,45,678', () => {
    expect(inr(12345678)).toBe('₹1,23,45,678')
  })

  it('handles negative', () => {
    expect(inr(-1234567)).toBe('-₹12,34,567')
  })

  it('rounds to integer', () => {
    expect(inr(1234.7)).toBe('₹1,235')
  })
})

describe('pct', () => {
  it('0.145 -> 14.5%', () => {
    expect(pct(0.145)).toBe('14.5%')
  })

  it('0.15 with dp=0 -> 15%', () => {
    expect(pct(0.15, 0)).toBe('15%')
  })

  it('0 -> 0.0%', () => {
    expect(pct(0)).toBe('0.0%')
  })

  it('1 -> 100.0%', () => {
    expect(pct(1)).toBe('100.0%')
  })
})

describe('compactInr', () => {
  it('1500000 -> ₹15.0L', () => {
    expect(compactInr(1500000)).toBe('₹15.0L')
  })

  it('12000000 -> ₹1.20Cr', () => {
    expect(compactInr(12000000)).toBe('₹1.20Cr')
  })

  it('100000 -> ₹1.0L', () => {
    expect(compactInr(100000)).toBe('₹1.0L')
  })

  it('below 1L uses inr format', () => {
    expect(compactInr(50000)).toBe('₹50,000')
  })

  it('negative crore', () => {
    expect(compactInr(-10000000)).toBe('-₹1.00Cr')
  })
})
