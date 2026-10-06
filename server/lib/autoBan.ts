/**
 * AUTOMATIC BANS FROM STRIKES — enforces the strike rules in the Terms of Service.
 *
 *   MINOR          6 in 30 days   → 3-day ban
 *   MODERATE       4 in 30 days   → 14-day ban
 *   SEVERE         1              → 30-day ban;  2 ever → permanent
 *   ZERO_TOLERANCE 1              → permanent
 *
 * Call `applyAutomaticBan` right after creating any strike. Reversed strikes never
 * count, staff accounts are never banned, and an existing longer ban is never shortened.
 */
import type { PrismaClient, StrikeLevel } from "@prisma/client"

const DAY_MS = 24 * 60 * 60 * 1000
const RECENT_WINDOW_MS = 30 * DAY_MS

/** "Permanent" bans are stored as a far-future date (matches the admin panel). */
export const PERMANENT_BAN_DATE = new Date("9999-12-31")

type StrikeForBanCheck = { level: StrikeLevel; createdAt: Date; reversed: boolean }

/**
 * Pure rule check: given a user's strikes, returns the ban they've earned
 * (end date + reason), or null if none. No database access — easy to test.
 */
export function decideAutomaticBan(
  strikes: StrikeForBanCheck[],
  now: Date = new Date(),
): { bannedUntil: Date; reason: string } | null {
  const activeStrikes = strikes.filter((strike) => !strike.reversed)
  const isRecent = (strike: StrikeForBanCheck) => now.getTime() - strike.createdAt.getTime() <= RECENT_WINDOW_MS
  const countWhere = (level: StrikeLevel, recentOnly: boolean) =>
    activeStrikes.filter((strike) => strike.level === level && (!recentOnly || isRecent(strike))).length
  const banForDays = (days: number) => new Date(now.getTime() + days * DAY_MS)

  // Checked from harshest to mildest — the first match is the longest ban.
  if (countWhere("ZERO_TOLERANCE", false) >= 1) {
    return { bannedUntil: PERMANENT_BAN_DATE, reason: "Zero-tolerance violation" }
  }
  if (countWhere("SEVERE", false) >= 2) {
    return { bannedUntil: PERMANENT_BAN_DATE, reason: "Two severe violations" }
  }
  if (countWhere("SEVERE", true) >= 1) {
    return { bannedUntil: banForDays(30), reason: "Severe violation" }
  }
  if (countWhere("MODERATE", true) >= 4) {
    return { bannedUntil: banForDays(14), reason: "4 moderate violations in 30 days" }
  }
  if (countWhere("MINOR", true) >= 6) {
    return { bannedUntil: banForDays(3), reason: "6 minor violations in 30 days" }
  }
  return null
}

/**
 * Looks at a user's strikes and bans them if a threshold is reached.
 * Sends an in-app notification. Never throws — a failure here must not undo
 * the moderation action that issued the strike.
 */
export async function applyAutomaticBan(prisma: PrismaClient, userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isAdmin: true,
        isModerator: true,
        bannedUntil: true,
        receivedStrikes: { select: { level: true, createdAt: true, reversed: true } },
      },
    })
    if (!user || user.isAdmin || user.isModerator) return

    const ban = decideAutomaticBan(user.receivedStrikes)
    if (!ban) return
    if (user.bannedUntil && user.bannedUntil >= ban.bannedUntil) return

    const isPermanent = ban.bannedUntil.getTime() === PERMANENT_BAN_DATE.getTime()
    const durationText = isPermanent ? "permanent" : `until ${ban.bannedUntil.toDateString()}`
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { bannedUntil: ban.bannedUntil, banReason: `Automatic: ${ban.reason}` },
      }),
      prisma.notification.create({
        data: {
          userId,
          fromUserId: null,
          type: "ban",
          message: `Your account has been suspended (${durationText}). Reason: ${ban.reason}.`,
        },
      }),
    ])
  } catch (err) {
    console.error("[auto-ban] failed for user", userId, err)
  }
}
