# Cookie Consent Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a GDPR-style cookie consent banner to EU users on first visit, remember their choice in localStorage, and never show it again once decided.

**Architecture:** A single client component (`CookieConsent`) detects EU timezone via `Intl.DateTimeFormat`, checks localStorage for a prior choice, and conditionally renders a fixed bottom banner. It mounts inside the root layout alongside `BanBanner` and `PushInit`. No backend, no schema changes needed.

**Tech Stack:** React (`useState`, `useEffect`), localStorage, `Intl.DateTimeFormat` for EU detection, Tailwind + inline styles matching existing app dark theme.

---

## Files

- **Create:** `components/CookieConsent.tsx` — the banner component
- **Modify:** `app/layout.tsx` — import and render `<CookieConsent />`

---

### Task 1: CookieConsent component

**Files:**
- Create: `components/CookieConsent.tsx`

- [ ] **Step 1: Create the component file**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const STORAGE_KEY = "cookie_consent"

function isEuTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz.startsWith("Europe/")
  } catch {
    return false // fail open — don't show banner if detection fails
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show if EU timezone AND no prior choice stored
    if (isEuTimezone() && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted")
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: 72, // above BottomNav (h-16 = 64px + a little breathing room)
        left: 0,
        right: 0,
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        padding: "0 16px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "#1a1a2e",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          pointerEvents: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          We use essential cookies to keep you signed in and make the platform work. We don&rsquo;t
          use tracking or advertising cookies.{" "}
          <Link href="/terms" style={{ color: "#B044F8", textDecoration: "underline" }}>
            Learn more
          </Link>
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={decline}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Decline
          </button>
          <button
            onClick={accept}
            style={{
              background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file was created correctly**

Open `components/CookieConsent.tsx` and confirm it has the `isEuTimezone` function, `useEffect` that reads from `localStorage`, and two buttons that call `accept()` and `decline()`.

- [ ] **Step 3: Commit**

```bash
git add components/CookieConsent.tsx
git commit -m "feat: add CookieConsent component (EU timezone detection + localStorage)"
```

---

### Task 2: Wire into root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add the import**

At the top of `app/layout.tsx`, add after the existing component imports:

```tsx
import CookieConsent from "@/components/CookieConsent"
```

- [ ] **Step 2: Render the component**

Inside `RootLayout`, place `<CookieConsent />` right after `<BanBanner />`:

```tsx
<Providers>
  <BanBanner />
  <CookieConsent />
  <PushInit />
  {/* Navbar: visible on mobile only — desktop uses the sidebar in BottomNav */}
  <div className="md:hidden">
    <Navbar />
  </div>
  <div className="pb-20 md:pb-0 md:pl-16 min-h-screen">
    {children}
    <footer style={{ padding: "16px 24px", textAlign: "center" }}>
      <Link href="/dmca" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
        DMCA / Copyright
      </Link>
    </footer>
  </div>
  <BottomNav />
</Providers>
```

- [ ] **Step 3: Manual smoke test**

Start the dev server (`npm run dev`) and open the app in a browser. Open DevTools → Application → Local Storage. Delete the `cookie_consent` key if it exists. Temporarily change `isEuTimezone()` to always return `true` to force the banner visible. Reload — the banner should appear above the bottom nav. Click "Accept" — banner disappears and `cookie_consent = "accepted"` appears in localStorage. Refresh — banner does not reappear. Repeat with "Decline" and confirm `cookie_consent = "declined"`. Revert the `isEuTimezone()` override.

- [ ] **Step 4: Update roadmap**

In `docs/roadmap.md`, change:
```
- [ ] Cookie consent banner for EU users
```
to:
```
- [x] Cookie consent banner for EU users
```

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx docs/roadmap.md
git commit -m "feat: wire CookieConsent into root layout, mark roadmap item done"
```

---

### Task 3: Deploy

- [ ] **Step 1: Deploy to production**

```bash
npx vercel --prod
```

Expected: build succeeds, deployment URL printed, aliased to `https://gallery-ebon-xi.vercel.app`.
