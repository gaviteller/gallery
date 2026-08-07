import { describe, it, expect } from 'vitest'
import { scanImage, getVerdict } from '../nsfw'

// 1x1 white pixel PNG — safe reference image for scanner tests
const WHITE_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('scanImage', () => {
  it('returns an object with all 5 score keys for a valid image', async () => {
    const scores = await scanImage(WHITE_PIXEL)
    expect(scores).not.toBeNull()
    expect(scores).toHaveProperty('Drawing')
    expect(scores).toHaveProperty('Hentai')
    expect(scores).toHaveProperty('Neutral')
    expect(scores).toHaveProperty('Porn')
    expect(scores).toHaveProperty('Sexy')
  }, 60_000)

  it('all scores are numbers in [0, 1]', async () => {
    const scores = await scanImage(WHITE_PIXEL)
    expect(scores).not.toBeNull()
    for (const val of Object.values(scores!)) {
      expect(typeof val).toBe('number')
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  }, 60_000)

  it('scores sum to approximately 1', async () => {
    const scores = await scanImage(WHITE_PIXEL)
    const sum = Object.values(scores!).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 1)
  }, 60_000)

  it('handles base64 without data URL prefix', async () => {
    const bare = WHITE_PIXEL.replace('data:image/png;base64,', '')
    const scores = await scanImage(bare)
    expect(scores).not.toBeNull()
  }, 60_000)

  it('returns null for completely invalid input instead of throwing', async () => {
    const result = await scanImage('not-valid-base64-at-all!!!')
    expect(result).toBeNull()
  })

  it('returns null for empty string instead of throwing', async () => {
    const result = await scanImage('')
    expect(result).toBeNull()
  })
})

describe('getVerdict', () => {
  it('returns SAFE when porn+hentai is low', () => {
    const verdict = getVerdict({ Drawing: 0.0, Hentai: 0.05, Neutral: 0.9, Porn: 0.02, Sexy: 0.03 })
    expect(verdict).toBe('SAFE')
  })

  it('returns EXPLICIT when porn is >= 0.8', () => {
    const verdict = getVerdict({ Drawing: 0.0, Hentai: 0.0, Neutral: 0.1, Porn: 0.85, Sexy: 0.05 })
    expect(verdict).toBe('EXPLICIT')
  })

  it('returns EXPLICIT when hentai pushes combined score >= 0.8', () => {
    const verdict = getVerdict({ Drawing: 0.0, Hentai: 0.5, Neutral: 0.1, Porn: 0.35, Sexy: 0.05 })
    expect(verdict).toBe('EXPLICIT')
  })

  it('returns SUGGESTIVE when combined porn+hentai is in 0.5–0.8 range', () => {
    const verdict = getVerdict({ Drawing: 0.0, Hentai: 0.1, Neutral: 0.3, Porn: 0.5, Sexy: 0.1 })
    expect(verdict).toBe('SUGGESTIVE')
  })

  it('returns SUGGESTIVE when sexy alone is >= 0.5', () => {
    const verdict = getVerdict({ Drawing: 0.0, Hentai: 0.05, Neutral: 0.3, Porn: 0.1, Sexy: 0.55 })
    expect(verdict).toBe('SUGGESTIVE')
  })

  it('returns SAFE for typical clean artwork', () => {
    const verdict = getVerdict({ Drawing: 0.7, Hentai: 0.01, Neutral: 0.25, Porn: 0.02, Sexy: 0.02 })
    expect(verdict).toBe('SAFE')
  })
})
