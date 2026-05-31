import { describe, it, expect } from "vitest"
import { matchesStyleChip, getStartingPrice, PRICE_BUCKETS, ART_STYLE_CHIPS } from "@/lib/art-styles"

describe("matchesStyleChip", () => {
  it("matches digital keyword", () => {
    expect(matchesStyleChip(["digital art", "illustration"], "Digital")).toBe(true)
  })
  it("is case-insensitive", () => {
    expect(matchesStyleChip(["DIGITAL PAINTING"], "Digital")).toBe(true)
  })
  it("returns false when no match", () => {
    expect(matchesStyleChip(["oil painting", "gouache"], "Digital")).toBe(false)
  })
  it("matches traditional via 'oil' keyword", () => {
    expect(matchesStyleChip(["oil painting"], "Traditional")).toBe(true)
  })
  it("matches pixel art", () => {
    expect(matchesStyleChip(["pixel art", "retro"], "Pixel Art")).toBe(true)
  })
  it("returns false for empty artStyles", () => {
    expect(matchesStyleChip([], "Anime/Manga")).toBe(false)
  })
})

describe("getStartingPrice", () => {
  it("returns lowest price from array", () => {
    expect(getStartingPrice([{ label: "Bust", price: 40 }, { label: "Full", price: 120 }])).toBe(40)
  })
  it("returns null for empty array", () => {
    expect(getStartingPrice([])).toBeNull()
  })
  it("returns null for null input", () => {
    expect(getStartingPrice(null)).toBeNull()
  })
  it("handles single item", () => {
    expect(getStartingPrice([{ label: "Icon", price: 15 }])).toBe(15)
  })
})

describe("PRICE_BUCKETS", () => {
  it("has 4 buckets", () => {
    expect(PRICE_BUCKETS).toHaveLength(4)
  })
  it("last bucket has max Infinity", () => {
    expect(PRICE_BUCKETS[3].max).toBe(Infinity)
  })
})

describe("ART_STYLE_CHIPS", () => {
  it("has 8 entries", () => {
    expect(ART_STYLE_CHIPS).toHaveLength(8)
  })
})
