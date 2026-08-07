import { describe, it, expect } from 'vitest'
import { categorise } from '../nsfw-categorise'
import type { NsfwScores } from '../nsfw'

const safe: NsfwScores    = { Drawing: 0.7, Hentai: 0.01, Neutral: 0.25, Porn: 0.02, Sexy: 0.02 }
const suggestive: NsfwScores = { Drawing: 0.0, Hentai: 0.05, Neutral: 0.3, Porn: 0.1, Sexy: 0.55 }
const explicitPorn: NsfwScores = { Drawing: 0.0, Hentai: 0.05, Neutral: 0.05, Porn: 0.85, Sexy: 0.05 }
const explicitHentai: NsfwScores = { Drawing: 0.0, Hentai: 0.85, Neutral: 0.05, Porn: 0.05, Sexy: 0.05 }

describe('categorise — safe content', () => {
  it('passes safe artwork on a post', () => {
    const r = categorise(safe, 'POST')
    expect(r.verdict).toBe('SAFE')
    expect(r.action).toBe('PASSED')
    expect(r.strikeLevel).toBeNull()
    expect(r.violationType).toBe('NONE')
  })

  it('passes safe content on a shop item', () => {
    const r = categorise(safe, 'SHOP_ITEM')
    expect(r.action).toBe('PASSED')
  })
})

describe('categorise — suggestive content', () => {
  it('routes suggestive post to PENDING_REVIEW', () => {
    const r = categorise(suggestive, 'POST')
    expect(r.verdict).toBe('SUGGESTIVE')
    expect(r.action).toBe('PENDING_REVIEW')
    expect(r.strikeLevel).toBeNull()
    expect(r.violationType).toBe('SUGGESTIVE')
  })

  it('routes suggestive avatar to PENDING_REVIEW', () => {
    const r = categorise(suggestive, 'AVATAR')
    expect(r.action).toBe('PENDING_REVIEW')
  })
})

describe('categorise — explicit content', () => {
  it('auto-removes explicit post with SEVERE strike', () => {
    const r = categorise(explicitPorn, 'POST')
    expect(r.verdict).toBe('EXPLICIT')
    expect(r.action).toBe('REMOVED')
    expect(r.strikeLevel).toBe('SEVERE')
    expect(r.violationType).toBe('EXPLICIT_SEXUAL')
  })

  it('auto-removes explicit shop item with SEVERE strike', () => {
    const r = categorise(explicitPorn, 'SHOP_ITEM')
    expect(r.action).toBe('REMOVED')
    expect(r.strikeLevel).toBe('SEVERE')
  })

  it('auto-removes explicit avatar with ZERO_TOLERANCE strike', () => {
    const r = categorise(explicitPorn, 'AVATAR')
    expect(r.action).toBe('REMOVED')
    expect(r.strikeLevel).toBe('ZERO_TOLERANCE')
  })

  it('auto-removes explicit banner with ZERO_TOLERANCE strike', () => {
    const r = categorise(explicitPorn, 'BANNER')
    expect(r.strikeLevel).toBe('ZERO_TOLERANCE')
  })

  it('identifies hentai correctly', () => {
    const r = categorise(explicitHentai, 'POST')
    expect(r.violationType).toBe('EXPLICIT_HENTAI')
    expect(r.action).toBe('REMOVED')
  })

  it('commission refs get SEVERE (not ZERO_TOLERANCE)', () => {
    const r = categorise(explicitPorn, 'COMMISSION_REF')
    expect(r.strikeLevel).toBe('SEVERE')
  })
})
