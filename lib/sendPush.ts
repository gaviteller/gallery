/**
 * PUSH NOTIFICATIONS — sends a phone/browser notification to every device
 * a user has allowed notifications on.
 *
 * Uses the Web Push standard; the VAPID keys in .env identify our server to
 * browsers. If the keys are missing, sending silently does nothing.
 */
import webpush from "web-push"
import { PrismaClient } from "@prisma/client"

function configureWebPushKeys() {
  const contactEmail = process.env.VAPID_EMAIL ?? "mailto:admin@gallery.app"
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? ""
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? ""
  if (publicKey && privateKey) {
    webpush.setVapidDetails(contactEmail, publicKey, privateKey)
  }
}

/**
 * Sends `payload` to all of a user's subscribed devices.
 * `url` is the page that opens when the notification is tapped.
 * Devices whose subscription has expired are removed automatically.
 */
export async function sendPushToUser(
  prisma: PrismaClient,
  userId: string,
  payload: { title: string; body: string; url: string; tag?: string }
) {
  configureWebPushKeys()
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subscriptions.length === 0) return

  const payloadJson = JSON.stringify(payload)

  await Promise.allSettled(
    subscriptions.map(async (device: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payloadJson
        )
      } catch (err: any) {
        // 410 Gone = subscription expired, clean it up
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: device.endpoint } })
        }
      }
    })
  )
}
