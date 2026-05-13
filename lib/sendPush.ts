import webpush from "web-push"
import { PrismaClient } from "@prisma/client"

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? "mailto:admin@gallery.app",
  process.env.VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
)

export async function sendPushToUser(
  prisma: PrismaClient,
  userId: string,
  payload: { title: string; body: string; url: string; tag?: string }
) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const json = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json
        )
      } catch (err: any) {
        // 410 Gone = subscription expired, clean it up
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } })
        }
      }
    })
  )
}
