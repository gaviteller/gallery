import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import Navbar from "@/components/Navbar"
import BottomNav from "@/components/BottomNav"

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
          <Navbar />
          <div className="pb-20">{children}</div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
