/** What a notification says and where it leads — shared by the bell panel and the /notifications inbox. */
export type NotificationLike = { type: string; message: string | null; fromUser: { username: string | null } | null }

export function notificationText(n: NotificationLike): string {
  if (n.message) return n.message
  const type = n.type.split(":")[0]
  const labels: Record<string, string> = {
    follow: "started following you",
    dm: "sent you a message",
    commission_request: "sent you a commission request",
    commission_message: "sent you a message",
    commission_accepted: "accepted your commission request",
    commission_declined: "declined your commission request",
    commission_cancelled: "cancelled their commission",
    commission_paid: "confirmed payment for their commission",
    commission_delivered: "delivered your commission",
    commission_complete: "confirmed commission receipt",
    ban: "Your account has been suspended.",
    lift_ban: "Your account suspension has been lifted.",
    post_deleted: "A post was removed from your account.",
    post_removed_tos: "A post was removed for violating our Terms of Service.",
    post_removed_dmca: "A post was removed following a DMCA claim.",
    post_pending_review: "One of your posts is under review.",
    appeal_approved: "Your appeal has been approved.",
    appeal_denied: "Your appeal has been denied.",
    site_notice: "A message from the Gallery team.",
    post_auto_removed: "A post was removed from your account.",
    commission_auto_released: "Payment for a commission was released automatically.",
    commission_auto_cancelled: "A commission was cancelled automatically.",
  }
  return labels[type ?? ""] ?? n.type
}

export function notificationLink(n: NotificationLike): string | null {
  if (!n.fromUser) return null
  if (n.type === "follow") return `/@${n.fromUser.username}`
  const [prefix, id] = n.type.split(":")
  if (prefix === "dm") return `/messages/${id}`
  if (id) return `/professional-dms/${id}`
  return null
}
