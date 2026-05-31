export const ART_STYLE_CHIPS = [
  "Digital",
  "Traditional",
  "Pixel Art",
  "3D",
  "Anime/Manga",
  "Sketch",
  "Watercolor",
  "Comics",
] as const

export type ArtStyleChip = (typeof ART_STYLE_CHIPS)[number]

// Case-insensitive keywords for each chip
export const ART_STYLE_KEYWORDS: Record<ArtStyleChip, string[]> = {
  Digital:       ["digital"],
  Traditional:   ["traditional", "oil", "acrylic", "gouache", "pastel"],
  "Pixel Art":   ["pixel"],
  "3D":          ["3d", "blender", "zbrush", "sculpt"],
  "Anime/Manga": ["anime", "manga", "chibi"],
  Sketch:        ["sketch", "lineart", "line art", "pencil"],
  Watercolor:    ["watercolor", "watercolour"],
  Comics:        ["comic", "comics", "cartoon", "illustration"],
}

/** Returns true if any of the artist's artStyles matches the chip's keywords */
export function matchesStyleChip(artStyles: string[], chip: ArtStyleChip): boolean {
  const keywords = ART_STYLE_KEYWORDS[chip]
  return artStyles.some(style =>
    keywords.some(kw => style.toLowerCase().includes(kw))
  )
}

export const PRICE_BUCKETS = [
  { label: "Under $25",  min: 0,   max: 24.99 },
  { label: "$25–$75",    min: 25,  max: 75 },
  { label: "$75–$150",   min: 75,  max: 150 },
  { label: "$150+",      min: 150, max: Infinity },
] as const

export type PriceBucket = (typeof PRICE_BUCKETS)[number]

/** Returns the lowest price across all priceRanges entries, or null if none */
export function getStartingPrice(
  priceRanges: { label: string; price: number }[] | null | unknown
): number | null {
  if (!Array.isArray(priceRanges) || priceRanges.length === 0) return null
  const prices = (priceRanges as { label: string; price: number }[])
    .map(r => r.price)
    .filter(Number.isFinite)
  return prices.length > 0 ? Math.min(...prices) : null
}
