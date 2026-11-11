"use client"
/**
 * Shows an in-site ad (made in the admin Ads page). Counts a view once it's half on screen
 * and a click when opened. Partner ads are labelled "Sponsored" and open in a new tab.
 */
import { useEffect, useRef } from "react"
import { ArrowUpRight } from "lucide-react"
import { trpc } from "@/components/providers"

export type AdData = {
  id: string
  preset: "ARTIST_SPOTLIGHT" | "PARTNER" | "GALLERY_PROMO"
  headline: string
  body: string | null
  imageUrl: string | null
  linkUrl: string
  frequency: number
  style?: unknown
}

/** Look of an ad, chosen in the admin ad maker. The admin app keeps a copy of these options. */
export type AdStyle = { font: keyof typeof AD_FONTS; size: keyof typeof AD_SIZES; fit: "fill" | "whole" }
export const AD_FONTS = {
  classic: "Georgia, 'Times New Roman', serif",
  modern: "Inter, 'Segoe UI', Arial, sans-serif",
  display: "var(--font-playfair), 'Playfair Display', Georgia, serif",
  handwritten: "'Segoe Print', 'Comic Sans MS', cursive",
} as const
/** Headline size multiplier. */
export const AD_SIZES = { small: 0.75, medium: 1, large: 1.3, huge: 1.65 } as const

/** Reads an ad's saved style, falling back to the defaults for anything missing or unknown. */
export function adStyle(raw: unknown): AdStyle {
  const s = (raw ?? {}) as Partial<Record<keyof AdStyle, string>>
  return {
    font: s.font && s.font in AD_FONTS ? (s.font as AdStyle["font"]) : "classic",
    size: s.size && s.size in AD_SIZES ? (s.size as AdStyle["size"]) : "medium",
    fit: s.fit === "whole" ? "whole" : "fill",
  }
}
const LABELS = { ARTIST_SPOTLIGHT: "Featured artist", PARTNER: "Sponsored", GALLERY_PROMO: "From Gallery" } as const

/** Active ads for one spot on the site. */
export function useAds(placement: "FEED" | "SIGNUP" | "SIDEBAR" | "EXPLORE" | "SHOP") {
  const { data } = trpc.ad.getForPlacement.useQuery({ placement }, { staleTime: 60_000 })
  return (data ?? []) as AdData[]
}

export default function AdCard({ ad, variant = "card" }: { ad: AdData; variant?: "card" | "banner" }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const seen = useRef(false)
  const recordView = trpc.ad.recordView.useMutation()
  const recordClick = trpc.ad.recordClick.useMutation()
  const recordViewRef = useRef(recordView.mutate)
  recordViewRef.current = recordView.mutate

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !seen.current) {
        seen.current = true
        recordViewRef.current({ id: ad.id })
        observer.disconnect()
      }
    }, { threshold: 0.5 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ad.id])

  const external = !ad.linkUrl.startsWith("/")
  const look = adStyle(ad.style)
  return (
    <a
      ref={ref}
      href={ad.linkUrl}
      className={`gx-ad gx-ad-${variant} gx-ad-${ad.preset.toLowerCase()}`}
      target={external ? "_blank" : undefined}
      rel={external ? (ad.preset === "PARTNER" ? "sponsored noopener noreferrer" : "noopener noreferrer") : undefined}
      onClick={() => recordClick.mutate({ id: ad.id })}
    >
      {ad.imageUrl && <img src={ad.imageUrl} alt="" draggable={false} style={look.fit === "whole" ? { objectFit: "contain", background: "#0b0c16" } : undefined} />}
      <span className="gx-ad-copy">
        <span className="gx-ad-label">{LABELS[ad.preset]}</span>
        <strong style={{ fontFamily: AD_FONTS[look.font], fontSize: 15 * AD_SIZES[look.size] }}>{ad.headline}</strong>
        {ad.body && <span className="gx-ad-body">{ad.body}</span>}
        <span className="gx-ad-cta">Take a look <ArrowUpRight size={14} /></span>
      </span>
    </a>
  )
}
