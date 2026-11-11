"use client"
/** Sends one visit to /api/track on every page change (see that route for the privacy notes). */
import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export default function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = pathname === "/search" ? searchParams.get("q") ?? undefined : undefined

  useEffect(() => {
    const referrer = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : undefined
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, search, referrer }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname, search])

  return null
}
