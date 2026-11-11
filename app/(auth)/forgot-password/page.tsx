"use client"
/** Codex-redesigned auth page — see components/redesign/AuthShell.tsx. */
import { Suspense } from "react"
import AuthShell from "@/components/redesign/AuthShell"

export default function Page() {
  return <Suspense fallback={null}><AuthShell mode="forgot" /></Suspense>
}
