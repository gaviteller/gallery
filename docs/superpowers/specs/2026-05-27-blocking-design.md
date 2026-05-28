# Blocking — Design Spec

Date: 2026-05-27

---

## Goal

Let users block each other for full mutual invisibility. A blocker cannot see the blocked user; the blocked user cannot see the blocker. Neither party is notified.

---

## Block Model

Already exists in `prisma/schema.prisma` — no migration needed:

```prisma
model Block {
  id        String   @id @default(cuid())
  blockerId String
  blockedId String
  blocker   User     @relation("BlockerRelation", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked   User     @relation("BlockedRelation", fields: [blockedId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([blockerId, blockedId])
  @@index([blockerId])
  @@index([blockedId])
}
```

---

## Block Semantics (Hard Block)

When user A blocks user B:
- A's posts disappear from B's feed and search
- B's posts disappear from A's feed and search
- A's profile is inaccessible to B (404 / redirect)
- B's profile is inaccessible to A (404 / redirect)
- Any existing follow relationships are deleted (both directions)
- DMs between them are hidden (not deleted — preserve history if block is later removed)
- Commission requests between them are blocked
- No notification is sent to either party

---

## tRPC

New router: `server/routers/block.ts` — all protected procedures.

### `block.toggle`

Input: `{ username: z.string() }`

Steps:
1. Look up target user by username; throw `NOT_FOUND` if missing
2. Cannot block yourself → throw `BAD_REQUEST`
3. Check for existing block where `blockerId = me, blockedId = target`
4. **If blocking (no existing block):**
   - Delete follow records in both directions (if any)
   - Create `Block { blockerId: me, blockedId: target }`
   - Return `{ blocked: true }`
5. **If unblocking (existing block):**
   - Delete the `Block` record
   - Return `{ blocked: false }`

### `block.status`

Input: `{ username: z.string() }`

Returns `{ blocked: boolean }` — whether the current user has blocked this profile.

### `block.getMyBlocked`

No input.

Returns list of users the current user has blocked: `{ id, username, name, image }[]`.
Ordered by `createdAt desc`.

---

## Enforcement Points

### Feed (`post.getFeed`)

Add to the existing query's `where` clause:

```ts
// Fetch IDs of users the viewer has blocked OR who have blocked the viewer
const blockRelations = userId
  ? await ctx.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    })
  : []

const blockedUserIds = new Set(
  blockRelations.map((b) => b.blockerId === userId ? b.blockedId : b.blockerId)
)
```

Then filter posts: `posts.filter(p => !blockedUserIds.has(p.userId))`

### Profile (`user.getByUsername`)

After resolving the profile user, check both directions:

```ts
if (ctx.session?.user?.id) {
  const block = await ctx.prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: ctx.session.user.id, blockedId: user.id },
        { blockerId: user.id, blockedId: ctx.session.user.id },
      ],
    },
  })
  if (block) throw new TRPCError({ code: "NOT_FOUND" })
}
```

### Search (`user.search`)

Exclude users who have a block relationship (either direction) with the searcher.

```ts
const blockRelations = ctx.session
  ? await ctx.prisma.block.findMany({
      where: { OR: [{ blockerId: ctx.session.user.id }, { blockedId: ctx.session.user.id }] },
      select: { blockerId: true, blockedId: true },
    })
  : []

const blockedIds = new Set(
  blockRelations.map((b) => b.blockerId === ctx.session!.user.id ? b.blockedId : b.blockerId)
)

// Add to findMany where: id: { notIn: [...blockedIds] }
```

### DMs (`dm` router)

When fetching or creating a DM conversation, check for a block in either direction and throw `FORBIDDEN` if one exists.

### Commissions

When a commission request is created, check for a block between requester and artist; throw `FORBIDDEN` if one exists.

---

## UI

### Profile page (`app/[username]/page.tsx`)

- Add a ⋯ "More" button next to the Follow button (only shown when `!isOwn`)
- Clicking it opens a small menu with "Block @username" / "Unblock @username"
- Uses `block.status` query to know current state
- On click: calls `block.toggle`, then navigates away if the action was Block (profile would now 404)
- Confirm dialog before blocking: "Block @username? They won't be able to see your profile or posts."

### Settings page (`app/settings/page.tsx`)

- New "Blocked accounts" section (or tab) — lists users from `block.getMyBlocked`
- Each row shows avatar + username + "Unblock" button
- Unblock calls `block.toggle`

### Profile 404 handling

When `user.getByUsername` throws `NOT_FOUND` due to a block, the profile page already handles `NOT_FOUND` gracefully (shows "User not found" or redirects). No new page needed.

---

## Files

**Create:**
- `server/routers/block.ts` — `toggle`, `status`, `getMyBlocked`

**Modify:**
- `server/routers/_app.ts` — add `block: blockRouter`
- `server/routers/post.ts` — filter blocked users from `getFeed`
- `server/routers/user.ts` — enforce block in `getByUsername`, `search`
- `server/routers/dm.ts` — enforce block in conversation creation/fetch
- `server/routers/commission.ts` — enforce block in commission request creation
- `app/[username]/page.tsx` — add ⋯ menu with block/unblock
- `app/settings/page.tsx` — add blocked accounts section

---

## Error Handling

| Scenario | Response |
|---|---|
| Block yourself | `BAD_REQUEST`: "You cannot block yourself." |
| Block unknown user | `NOT_FOUND` |
| View blocked profile | Profile returns `NOT_FOUND` (no message explaining why) |
| DM blocked user | `FORBIDDEN` |
| Commission to blocked user | `FORBIDDEN` |

---

## Out of Scope

- Showing the blocked person a special "you've been blocked" message (privacy)
- Preserving vs. deleting DM history (DMs are hidden, not deleted)
- Admin ability to view/override blocks
