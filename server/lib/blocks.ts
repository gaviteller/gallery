/**
 * BLOCK LOOKUPS shared by every list that must hide blocked users
 * (search, discovery, user search...).
 */
import type { PrismaClient } from "@prisma/client"

/**
 * Ids of everyone the viewer blocked AND everyone who blocked the viewer —
 * blocking hides both people from each other. Empty for logged-out visitors.
 */
export async function getBlockedUserIds(
  prisma: PrismaClient,
  viewerId: string | undefined | null,
): Promise<Set<string>> {
  const blockedIds = new Set<string>()
  if (!viewerId) return blockedIds
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  })
  for (const block of blocks) {
    blockedIds.add(block.blockerId === viewerId ? block.blockedId : block.blockerId)
  }
  return blockedIds
}

/** Prisma `where` fragment that excludes the given user ids (or nothing, if the set is empty). */
export function excludeIds(field: "id" | "userId", ids: Set<string>) {
  return ids.size > 0 ? { [field]: { notIn: [...ids] } } : {}
}
