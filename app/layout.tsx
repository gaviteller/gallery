export const dynamic = 'force-dynamic'

import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import "./globals.css"
import "./gallery-feed.css"
import "./gallery-final.css"
import { Providers } from "@/components/providers"
import Navbar from "@/components/Navbar"
import BottomNav from "@/components/BottomNav"
import PushInit from "@/components/PushInit"
import BanBanner from "@/components/BanBanner"
import CookieConsent from "@/components/CookieConsent"
import Link from "next/link"

const inter = Inter({ subsets: ["latin"] })
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-playfair" })

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
      <body className={`${inter.className} ${playfair.variable}`}>
        <Providers>
          <BanBanner />
          <CookieConsent />
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
