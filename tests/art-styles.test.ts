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

describe("matchesStyleChip — regression", () => {
  it("'illustration' does NOT match Comics (removed to avoid false categorisation)", () => {
    expect(matchesStyleChip(["digital illustration"], "Comics")).toBe(false)
  })
  it("'illustration' still matches Digital (digital substring)", () => {
    expect(matchesStyleChip(["digital illustration"], "Digital")).toBe(true)
  })
})

describe("PRICE_BUCKETS", () => {
  it("has 4 buckets", () => {
    expect(PRICE_BUCKETS).toHaveLength(4)
  })
  it("last bucket has max Infinity", () => {
    expect(PRICE_BUCKETS[3].max).toBe(Infinity)
  })
  it("bucket boundaries are non-overlapping", () => {
    // 24.99 belongs only to Under $25
    expect(PRICE_BUCKETS[0].max).toBeLessThan(PRICE_BUCKETS[1].min)
    // 74.99 belongs only to $25–$75
    expect(PRICE_BUCKETS[1].max).toBeLessThan(PRICE_BUCKETS[2].min)
    // 149.99 belongs only to $75–$150
    expect(PRICE_BUCKETS[2].max).toBeLessThan(PRICE_BUCKETS[3].min)
  })
  it("boundary value 25 falls in $25–$75 bucket", () => {
    const bucket = PRICE_BUCKETS.find(b => 25 >= b.min && 25 <= b.max)
    expect(bucket?.label).toBe("$25–$75")
  })
  it("boundary value 75 falls in $75–$150 bucket", () => {
    const bucket = PRICE_BUCKETS.find(b => 75 >= b.min && 75 <= b.max)
    expect(bucket?.label).toBe("$75–$150")
  })
  it("boundary value 150 falls in $150+ bucket", () => {
    const bucket = PRICE_BUCKETS.find(b => 150 >= b.min && 150 <= b.max)
    expect(bucket?.label).toBe("$150+")
  })
})

describe("getStartingPrice — edge cases", () => {
  it("filters out non-finite prices (NaN, Infinity)", () => {
    expect(getStartingPrice([{ label: "A", price: NaN }, { label: "B", price: 50 }])).toBe(50)
  })
  it("returns 0 for a free commission", () => {
    expect(getStartingPrice([{ label: "Free", price: 0 }])).toBe(0)
  })
})

describe("ART_STYLE_CHIPS", () => {
  it("has 8 entries", () => {
    expect(ART_STYLE_CHIPS).toHaveLength(8)
  })
})
