import { useId, type SVGProps } from "react"

type GalleryLogoProps = SVGProps<SVGSVGElement> & {
  title?: string
  markOnly?: boolean
}

export default function GalleryLogo({ title = "Gallery", markOnly = false, ...props }: GalleryLogoProps) {
  // Each logo on the page needs its own gradient/filter ids. With shared ids, a copy
  // inside a hidden header "owns" the gradient and the visible copy renders without its fill.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const logoGradientId = `galleryLogoGradient-${uid}`
  const tagGradientId = `galleryTagGradient-${uid}`
  const glowFilterId = `galleryLogoGlow-${uid}`
  return (
    <svg viewBox={markOnly ? "0 0 150 132" : "0 0 410 132"} role="img" aria-label={title} {...props}>
      <defs>
        <linearGradient id={logoGradientId} x1="22" y1="116" x2="164" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#16c9f5" />
          <stop offset=".27" stopColor="#347eff" />
          <stop offset=".55" stopColor="#7c43ff" />
          <stop offset=".78" stopColor="#d82ee9" />
          <stop offset="1" stopColor="#ff2aa8" />
        </linearGradient>
        <linearGradient id={tagGradientId} x1="180" y1="0" x2="390" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff35b6" />
          <stop offset=".5" stopColor="#9c50ff" />
          <stop offset="1" stopColor="#22c7f4" />
        </linearGradient>
        <filter id={glowFilterId} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 .32  0 1 0 0 .05  0 0 1 0 .72  0 0 0 .55 0" />
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <g className="gallery-logo-vector-paths" filter={`url(#${glowFilterId})`}>
        <path d="M145 29C132 11 111 3 83 5 43 8 17 34 13 69 9 103 34 126 70 128c29 2 53-9 70-29V67H78v23h34c-9 10-21 15-37 15-23 0-38-14-38-36 0-24 18-40 43-40 17 0 29 5 39 16z" fill={`url(#${logoGradientId})`} />
        <path d="M31 34C49 17 73 10 102 15" fill="none" stroke="#ff36b3" strokeWidth="14" strokeLinecap="round" opacity=".9" />
        <path d="M28 43C48 25 72 18 98 21" fill="none" stroke="#ff72cf" strokeWidth="3.2" strokeLinecap="round" opacity=".8" />
        <path d="M65 105c22 3 41-4 55-18" fill="none" stroke="#21c9f2" strokeWidth="4" strokeLinecap="round" opacity=".72" />
      </g>

      {!markOnly && <g className="gallery-logo-wordmark" fill="#f8f7fb">
        <text x="150" y="78" fontFamily="Montserrat, Arial, sans-serif" fontSize="42" fontWeight="300" letterSpacing="12">ALLERY</text>
        <rect x="151" y="106" width="14" height="1.5" rx=".75" fill="#ff35b6" />
        <text x="174" y="110" fontFamily="Montserrat, Arial, sans-serif" fontSize="8.5" fontWeight="700" letterSpacing="3" fill={`url(#${tagGradientId})`}>ANYONE CAN BE AN ARTIST</text>
        <rect x="385" y="106" width="15" height="1.5" rx=".75" fill="#20c8ef" />
      </g>}
    </svg>
  )
}
