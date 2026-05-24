export const dynamic = 'force-dynamic'

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import Navbar from "@/components/Navbar"
import BottomNav from "@/components/BottomNav"
import PushInit from "@/components/PushInit"
import BanBanner from "@/components/BanBanner"

const inter = Inter({ subsets: ["latin"] })

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
      <body className={inter.className}>
        <Providers>
          <BanBanner />
          <PushInit />
          {/* Navbar: visible on mobile only — desktop uses the sidebar in BottomNav */}
          <div className="md:hidden">
            <Navbar />
          </div>
          <div className="pb-20 md:pb-0 md:pl-16 min-h-screen">
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
