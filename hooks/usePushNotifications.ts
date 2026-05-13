"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function usePushNotifications() {
  const { status } = useSession()
  const { data: keyData } = trpc.push.getPublicKey.useQuery(undefined, {
    enabled: status === "authenticated",
  })
  const subscribe = trpc.push.subscribe.useMutation()
  const attempted = useRef(false)

  useEffect(() => {
    if (status !== "authenticated") return
    if (!keyData?.publicKey) return
    if (attempted.current) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    attempted.current = true

    async function register() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")

        // Don't prompt again if already granted or denied
        if (Notification.permission === "denied") return

        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          // Already subscribed — make sure it's saved server-side
          const key = existing.getKey("p256dh")
          const auth = existing.getKey("auth")
          if (key && auth) {
            subscribe.mutate({
              endpoint: existing.endpoint,
              p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
              auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
            })
          }
          return
        }

        // Ask for permission if not yet granted
        const permission = await Notification.requestPermission()
        if (permission !== "granted") return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData!.publicKey) as unknown as ArrayBuffer,
        })

        const key = sub.getKey("p256dh")
        const auth = sub.getKey("auth")
        if (key && auth) {
          subscribe.mutate({
            endpoint: sub.endpoint,
            p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
            auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
          })
        }
      } catch {
        // Push not available on this device/browser — silently ignore
      }
    }

    register()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, keyData?.publicKey])
}
