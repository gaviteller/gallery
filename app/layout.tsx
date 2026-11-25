import type { Metadata } from "next"
import "./globals.css"
import "./gallery-feed.css"
import "./gallery-final.css"
import { Providers } from "@/components/providers"
import Navbar from "@/components/Navbar"
import BottomNav from "@/components/BottomNav"
import PushInit from "@/components/PushInit"
import BanBanner from "@/components/BanBanner"
import CookieConsent from "@/components/CookieConsent"
import PageViewTracker from "@/components/PageViewTracker"
import { Suspense } from "react"
import Link from "next/link"

// Fonts load straight from Google Fonts. (next/font/google broke on Google's current font addresses.)
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Playfair+Display:wght@400;700&display=swap"

export const metadata: Metadata = {
  title: "Gallery",
  description: "The platform built for every kind of creator",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <Providers>
          <BanBanner />
          <CookieConsent />
          <Suspense fallback={null}><PageViewTracker /></Suspense>
          <PushInit />
          <Navbar />
          {/* Fills the height left under the header (see body/.main-layout in globals.css).
              Column layout so a page's root can use `flex: "1 0 auto"` to fill the space
              between the header and bottom nav (instead of 100vh, which overflows). */}
          <div className="main-layout" style={{ maxWidth: 470, margin: "0 auto", paddingTop: 56, paddingBottom: 80, boxSizing: "border-box" as const, display: "flex", flexDirection: "column" }}>
            {children}
            <footer style={{ padding: "16px 24px", textAlign: "center" }}>
              <Link href="/dmca" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                DMCA / Copyright
              </Link>
            </footer>
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
