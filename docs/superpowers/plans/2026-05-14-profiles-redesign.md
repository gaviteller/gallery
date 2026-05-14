# Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add follower/following counts + mutual followers, a Follow button, tab visibility rules, post pinning, a redesigned Commissions tab with info card and example gallery, and an About tab with the commission status badge moved out of the header.

**Architecture:** Schema gets one new field (`Post.pinned`). Two new tRPC mutations handle pin/unpin. The follow router gains a `mutuals` query. The profile page (`app/[username]/page.tsx`) and `PostModal` are updated for all UI changes.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5 / PostgreSQL, Tailwind v4, NextAuth v4.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `pinned Boolean @default(false)` to `Post` |
| `server/routers/post.ts` | Add `pin`/`unpin` mutations; update `getByUsername` to sort pinned first and include `pinned` field |
| `server/routers/follow.ts` | Add `mutuals` query |
| `components/PostModal.tsx` | Add `pinned?` and `onPinToggle?` props; add Pin/Unpin button for own posts |
| `app/[username]/page.tsx` | Header: follower counts + follow button + mutual followers modal; smart tab visibility; posts grid pin icon; commissions tab card + gallery; about tab status badge |

---

### Task 1: Schema — add `pinned` to Post

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `pinned` field to Post model**

Find the `Post` model. After `isCommission  Boolean   @default(false)`, add:
```prisma
pinned         Boolean   @default(false)
```

Full updated Post model:
```prisma
model Post {
  id             String    @id @default(cuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  image          String    @db.Text
  title          String?
  description    String?
  isAiGenerated  Boolean   @default(false)
  isCommission   Boolean   @default(false)
  pinned         Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  likes          Like[]
  comments       Comment[]
  hashtags       Hashtag[]
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-post-pinned
```
Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add pinned field to Post schema"
```

---

### Task 2: Backend — post pin/unpin mutations + updated getByUsername

**Files:**
- Modify: `server/routers/post.ts`

- [ ] **Step 1: Add `pin` mutation**

Add after the `delete` mutation:
```ts
pin: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const post = await ctx.prisma.post.findUnique({ where: { id: input.id } })
    if (!post) throw new TRPCError({ code: "NOT_FOUND" })
    if (post.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })

    // Enforce max 3 pinned posts
    const pinnedCount = await ctx.prisma.post.count({
      where: { userId: ctx.session.user.id, pinned: true },
    })
    if (pinnedCount >= 3) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You can only pin up to 3 posts." })
    }

    return ctx.prisma.post.update({ where: { id: input.id }, data: { pinned: true } })
  }),

unpin: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const post = await ctx.prisma.post.findUnique({ where: { id: input.id } })
    if (!post) throw new TRPCError({ code: "NOT_FOUND" })
    if (post.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
    return ctx.prisma.post.update({ where: { id: input.id }, data: { pinned: false } })
  }),
```

- [ ] **Step 2: Update `getByUsername` to sort pinned first**

Replace the existing `getByUsername` query:
```ts
getByUsername: publicProcedure
  .input(z.object({ username: z.string() }))
  .query(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findFirst({
      where: { username: { equals: input.username, mode: "insensitive" } },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    return ctx.prisma.post.findMany({
      where: { userId: user.id },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    })
  }),
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/routers/post.ts
git commit -m "feat: pin/unpin mutations and pinned-first sort for profile posts"
```

---

### Task 3: Backend — follow mutuals query

**Files:**
- Modify: `server/routers/follow.ts`

- [ ] **Step 1: Add `mutuals` query**

Add after the `status` query:
```ts
mutuals: publicProcedure
  .input(z.object({ username: z.string() }))
  .query(async ({ ctx, input }) => {
    if (!ctx.session) return { count: 0, users: [] }

    const target = await ctx.prisma.user.findFirst({
      where: { username: { equals: input.username, mode: "insensitive" } },
      select: { id: true },
    })
    if (!target) return { count: 0, users: [] }

    // People the current user follows
    const myFollowing = await ctx.prisma.follow.findMany({
      where: { followerId: ctx.session.user.id },
      select: { followingId: true },
    })
    const myFollowingIds = myFollowing.map((f) => f.followingId)

    // Of those, which also follow the target?
    const mutualFollows = await ctx.prisma.follow.findMany({
      where: {
        followingId: target.id,
        followerId: { in: myFollowingIds },
      },
      select: {
        follower: { select: { id: true, username: true, name: true, image: true } },
      },
    })

    const users = mutualFollows.map((f) => f.follower)
    return { count: users.length, users }
  }),
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/routers/follow.ts
git commit -m "feat: mutual followers query"
```

---

### Task 4: PostModal — pin/unpin button

**Files:**
- Modify: `components/PostModal.tsx`

- [ ] **Step 1: Extend the `Post` type and add new props**

At the top of `PostModal.tsx`, the `Post` type currently is:
```ts
type Post = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  createdAt: Date
}
```

Replace it with:
```ts
type Post = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  createdAt: Date
  pinned?: boolean
}
```

- [ ] **Step 2: Add `onPinToggle` prop to the component signature**

The current component signature is:
```ts
export default function PostModal({
  post,
  profileUser,
  isOwn,
  onClose,
  onDelete,
  autoFocusComment = false,
}: {
  post: Post
  profileUser: ProfileUser
  isOwn: boolean
  onClose: () => void
  onDelete: (id: string) => void
  autoFocusComment?: boolean
})
```

Replace with:
```ts
export default function PostModal({
  post,
  profileUser,
  isOwn,
  onClose,
  onDelete,
  onPinToggle,
  autoFocusComment = false,
}: {
  post: Post
  profileUser: ProfileUser
  isOwn: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onPinToggle?: () => void
  autoFocusComment?: boolean
})
```

- [ ] **Step 3: Add pin/unpin mutations inside the component**

After the `deletePost` mutation line:
```ts
const deletePost = trpc.post.delete.useMutation({ onSuccess: () => onDelete(post.id) })
```

Add:
```ts
const pinPost = trpc.post.pin.useMutation({ onSuccess: () => onPinToggle?.() })
const unpinPost = trpc.post.unpin.useMutation({ onSuccess: () => onPinToggle?.() })
```

- [ ] **Step 4: Add Pin/Unpin button in the header**

The current header for own posts shows only a Delete button:
```tsx
{isOwn && (
  <button onClick={() => deletePost.mutate({ id: post.id })} disabled={deletePost.isPending}
    className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50">
    {deletePost.isPending ? "Deleting…" : "Delete"}
  </button>
)}
```

Replace with:
```tsx
{isOwn && (
  <div className="flex items-center gap-3">
    {onPinToggle && (
      <button
        onClick={() => post.pinned
          ? unpinPost.mutate({ id: post.id })
          : pinPost.mutate({ id: post.id })
        }
        disabled={pinPost.isPending || unpinPost.isPending}
        className="text-xs text-white/50 hover:text-white font-medium disabled:opacity-50 px-2 py-1 rounded-lg transition-colors"
        style={{ background: "#ffffff10" }}
      >
        {pinPost.isPending || unpinPost.isPending
          ? "…"
          : post.pinned ? "Unpin" : "Pin"}
      </button>
    )}
    <button onClick={() => deletePost.mutate({ id: post.id })} disabled={deletePost.isPending}
      className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50">
      {deletePost.isPending ? "Deleting…" : "Delete"}
    </button>
  </div>
)}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/PostModal.tsx
git commit -m "feat: pin/unpin button in PostModal"
```

---

### Task 5: Profile page — header (follow button, counts, mutual followers)

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Add new queries and state at the top of ProfilePage**

After the existing queries (around line 62–68), add:
```ts
const { data: followStatus, refetch: refetchFollow } = trpc.follow.status.useQuery({ username })
const { data: mutualData } = trpc.follow.mutuals.useQuery(
  { username },
  { enabled: !isOwn }
)
const followMutation = trpc.follow.follow.useMutation({ onSuccess: () => refetchFollow() })
const unfollowMutation = trpc.follow.unfollow.useMutation({ onSuccess: () => refetchFollow() })

const [showMutuals, setShowMutuals] = useState(false)
```

Note: `isOwn` is calculated at line 148 of the current file. Move the queries below that line, or set `enabled: session?.user?.id !== profileUser?.id` as the condition instead.

The correct placement is after `const isOwn = session?.user?.id === profileUser.id` (which is after the loading/not-found guards). Restructure the top of the component so all queries are together, with the follow/mutuals queries using `enabled: !isOwn` and placed after `isOwn` is computed. Since hooks can't be conditional, use the `enabled` option on the query.

Concretely: add these four lines after all the existing `trpc.*useQuery` calls near the top, before the `if (userLoading)` guard:
```ts
const { data: followStatus, refetch: refetchFollow } = trpc.follow.status.useQuery(
  { username },
  { enabled: !!profileUser }
)
const { data: mutualData } = trpc.follow.mutuals.useQuery(
  { username },
  { enabled: !!profileUser && !!session && session.user.id !== profileUser?.id }
)
const followMutation = trpc.follow.follow.useMutation({ onSuccess: () => refetchFollow() })
const unfollowMutation = trpc.follow.unfollow.useMutation({ onSuccess: () => refetchFollow() })
```

And add `showMutuals` to the existing `useState` block:
```ts
const [showMutuals, setShowMutuals] = useState(false)
```

- [ ] **Step 2: Replace the header section**

The current header is lines 167–228. Replace the entire `{/* Header */}` block with:

```tsx
{/* Mutual followers modal */}
{showMutuals && mutualData && (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowMutuals(false)}>
    <div className="w-full max-w-lg rounded-t-2xl pb-8" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }} onClick={e => e.stopPropagation()}>
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: "#ffffff20" }} />
      </div>
      <p className="text-sm font-semibold text-white px-4 pb-3" style={{ borderBottom: "1px solid #ffffff10" }}>
        Mutual followers
      </p>
      <div className="max-h-72 overflow-y-auto">
        {mutualData.users.map(u => (
          <button key={u.id} onClick={() => { setShowMutuals(false); router.push(`/@${u.username}`) }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
            {u.image
              ? <img src={u.image} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
              : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>{(u.name ?? u.username ?? "?")[0].toUpperCase()}</div>
            }
            <div>
              <p className="text-sm font-semibold text-white">@{u.username}</p>
              {u.name && <p className="text-xs text-white/40">{u.name}</p>}
            </div>
          </button>
        ))}
        {mutualData.users.length === 0 && (
          <p className="text-sm text-white/40 text-center py-6">No mutual followers</p>
        )}
      </div>
    </div>
  </div>
)}

{/* Header */}
<div className="flex items-start gap-6 mb-8">
  {profileUser.image ? (
    <img src={profileUser.image} alt={profileUser.name ?? profileUser.username ?? "Profile"} className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
  ) : (
    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
      {initials}
    </div>
  )}

  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-3 flex-wrap">
      <h1 className="text-xl font-bold text-white">@{profileUser.username}</h1>
      {isOwn ? (
        <Link href="/settings" className="text-sm px-3 py-1 rounded-lg text-white/60 hover:text-white transition-colors" style={{ border: "1px solid #ffffff20" }}>
          Edit profile
        </Link>
      ) : session && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => followStatus?.following
              ? unfollowMutation.mutate({ username })
              : followMutation.mutate({ username })
            }
            disabled={followMutation.isPending || unfollowMutation.isPending}
            className="text-sm px-4 py-1.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
            style={followStatus?.following
              ? { background: "#ffffff15", border: "1px solid #ffffff30" }
              : { background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }
            }
          >
            {followMutation.isPending || unfollowMutation.isPending
              ? "…"
              : followStatus?.following ? "Following" : "Follow"}
          </button>
          <button
            onClick={() => getOrCreateDM.mutate({ otherUserId: profileUser.id })}
            disabled={getOrCreateDM.isPending}
            className="text-sm px-3 py-1.5 rounded-lg text-white/60 hover:text-white transition-colors disabled:opacity-50"
            style={{ border: "1px solid #ffffff20" }}
          >
            {getOrCreateDM.isPending ? "Opening…" : "Message"}
          </button>
        </div>
      )}
    </div>

    {profileUser.name && (
      <p className="text-white/60 text-sm font-medium mt-0.5">{profileUser.name}</p>
    )}

    {/* Follower / following counts */}
    <div className="flex items-center gap-4 mt-2">
      <span className="text-sm text-white/70">
        <span className="font-bold text-white">{followStatus?.followerCount ?? 0}</span> followers
      </span>
      <span className="text-sm text-white/70">
        <span className="font-bold text-white">{followStatus?.followingCount ?? 0}</span> following
      </span>
      {!isOwn && mutualData && mutualData.count > 0 && (
        <button onClick={() => setShowMutuals(true)} className="text-sm text-cyan-400 hover:underline">
          {mutualData.count} mutual
        </button>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: follow button, follower counts, and mutual followers on profile header"
```

---

### Task 6: Profile page — smart tab visibility

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Replace the tabs nav with visibility-aware version**

The current tabs nav (around line 231–245) renders all four tabs always. Replace:
```tsx
{/* Tabs */}
<div className="mb-6" style={{ borderBottom: "1px solid #ffffff10" }}>
  <nav className="flex gap-6">
    {["Posts", "Shop", "Commissions", "About"].map((t) => (
      <button
        key={t}
        onClick={() => setTab(t)}
        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
          tab === t ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"
        }`}
      >
        {t}
      </button>
    ))}
  </nav>
</div>
```

With:
```tsx
{/* Tabs */}
<div className="mb-6" style={{ borderBottom: "1px solid #ffffff10" }}>
  <nav className="flex gap-6">
    {(["Posts", "Shop", "Commissions", "About"] as const).filter((t) => {
      if (isOwn) return true
      if (t === "Shop" && (!shopItems || shopItems.length === 0)) return false
      if (t === "Commissions" && commissionProfile?.commissionStatus === "CLOSED") return false
      return true
    }).map((t) => (
      <button
        key={t}
        onClick={() => setTab(t)}
        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
          tab === t ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"
        }`}
      >
        {t}
      </button>
    ))}
  </nav>
</div>
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: hide commission and shop tabs on other profiles when empty/closed"
```

---

### Task 7: Profile page — posts tab pinning

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Update the `PostItem` type to include `pinned`**

At the top of the file, the current `PostItem` type is:
```ts
type PostItem = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  isCommission: boolean
  createdAt: Date
}
```

Replace with:
```ts
type PostItem = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  isCommission: boolean
  pinned: boolean
  createdAt: Date
}
```

- [ ] **Step 2: Add pin icon to pinned posts in the grid (owner only)**

In the Posts tab grid, find the post grid item:
```tsx
<button key={post.id} onClick={() => setViewPost(post as PostItem)}
  className="relative aspect-square overflow-hidden group" style={{ background: "#ffffff08" }}>
  <img src={post.image} alt={post.description ?? ""} className="w-full h-full object-cover" />
  <div className="absolute top-1.5 left-1.5 flex gap-1">
    {post.isAiGenerated && (
      <span className="text-xs font-medium bg-purple-600/80 text-white px-1.5 py-0.5 rounded-md">AI</span>
    )}
    {(post as PostItem).isCommission && (
      <span className="text-xs font-medium bg-blue-600/80 text-white px-1.5 py-0.5 rounded-md">Comm</span>
    )}
  </div>
```

Replace with:
```tsx
<button key={post.id} onClick={() => setViewPost(post as PostItem)}
  className="relative aspect-square overflow-hidden group" style={{ background: "#ffffff08" }}>
  <img src={post.image} alt={post.description ?? ""} className="w-full h-full object-cover" />
  <div className="absolute top-1.5 left-1.5 flex gap-1">
    {post.isAiGenerated && (
      <span className="text-xs font-medium bg-purple-600/80 text-white px-1.5 py-0.5 rounded-md">AI</span>
    )}
    {(post as PostItem).isCommission && (
      <span className="text-xs font-medium bg-blue-600/80 text-white px-1.5 py-0.5 rounded-md">Comm</span>
    )}
  </div>
  {isOwn && (post as PostItem).pinned && (
    <div className="absolute top-1.5 right-1.5">
      <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16 1v10l2 3H6l2-3V1h8zm-5 19a1 1 0 002 0v-5h-2v5zM9 1h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    </div>
  )}
```

- [ ] **Step 3: Pass `onPinToggle` to PostModal**

Find the `PostModal` usage at the bottom of the file:
```tsx
{viewPost && (
  <PostModal
    post={viewPost}
    profileUser={{ username: profileUser.username, name: profileUser.name, image: profileUser.image }}
    isOwn={isOwn}
    onClose={() => setViewPost(null)}
    onDelete={() => {
      utils.post.getByUsername.invalidate({ username })
      utils.post.getCommissionsByUsername.invalidate({ username })
      setViewPost(null)
    }}
  />
)}
```

Replace with:
```tsx
{viewPost && (
  <PostModal
    post={viewPost}
    profileUser={{ username: profileUser.username, name: profileUser.name, image: profileUser.image }}
    isOwn={isOwn}
    onClose={() => setViewPost(null)}
    onDelete={() => {
      utils.post.getByUsername.invalidate({ username })
      utils.post.getCommissionsByUsername.invalidate({ username })
      setViewPost(null)
    }}
    onPinToggle={isOwn ? () => {
      utils.post.getByUsername.invalidate({ username })
      setViewPost(null)
    } : undefined}
  />
)}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: pinned post indicator and pin/unpin via PostModal on profile"
```

---

### Task 8: Profile page — Commissions tab redesign + About tab

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Replace the Commissions tab content**

Find the entire `{tab === "Commissions" && ( ... )}` block (lines 357–422 in the current file) and replace it with:

```tsx
{/* ── Commissions tab ───────────────────────────────────── */}
{tab === "Commissions" && (
  <>
    {/* Info card */}
    <div className="rounded-2xl p-5 mb-6" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
      {/* Trust score */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Trust Score</span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full text-white/40" style={{ background: "#ffffff10" }}>
          New Artist
        </span>
      </div>

      {commissionProfile?.commissionDescription && (
        <p className="text-sm text-white/70 mb-4">{commissionProfile.commissionDescription}</p>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        {commissionProfile?.commissionTurnaround && (
          <div>
            <p className="text-xs text-white/40 mb-0.5">Turnaround</p>
            <p className="text-sm font-medium text-white">{commissionProfile.commissionTurnaround}</p>
          </div>
        )}
        {commissionProfile?.priceRanges && (commissionProfile.priceRanges as { label: string; price: number }[]).length > 0 && (
          <div>
            <p className="text-xs text-white/40 mb-0.5">Price ranges</p>
            <div className="flex flex-wrap gap-1.5">
              {(commissionProfile.priceRanges as { label: string; price: number }[]).map((r) => (
                <span key={r.label} className="text-xs px-2 py-0.5 rounded-full text-white/70" style={{ background: "#ffffff10" }}>
                  {r.label} — ${r.price}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isOwn && commissionProfile && commissionProfile.commissionStatus !== "CLOSED" && (
        <button
          onClick={() => setShowCommissionRequest(true)}
          className="w-full py-3 text-white rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
        >
          Request Commission
        </button>
      )}
    </div>

    {/* Example work gallery */}
    {commissionProfile?.commissionCardImages && commissionProfile.commissionCardImages.length > 0 ? (
      <>
        <p className="text-xs text-white/40 mb-3 uppercase tracking-wide font-semibold">Example work</p>
        <div className="grid grid-cols-3 gap-0.5">
          {commissionProfile.commissionCardImages.map((img, i) => (
            <div key={i} className="relative aspect-square overflow-hidden" style={{ background: "#ffffff08" }}>
              <img src={img} alt={`Example ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </>
    ) : (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🎨</div>
        <p className="font-medium text-white/50">No example work yet</p>
        {isOwn && (
          <p className="text-sm mt-1 text-white/30">Add images in your Artist Dashboard</p>
        )}
      </div>
    )}
  </>
)}
```

- [ ] **Step 2: Replace the About tab content**

Find the entire `{tab === "About" && ( ... )}` block (lines 424–475) and replace it with:

```tsx
{/* ── About tab ─────────────────────────────────────────── */}
{tab === "About" && (
  <div className="flex flex-col gap-5 max-w-sm">
    {/* Commission status badge */}
    {profileUser.sellingEnabled && (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Commission status</p>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[profileUser.commissionStatus as keyof typeof statusColors] ?? "bg-white/10 text-white/30"}`}>
          {statusLabels[profileUser.commissionStatus as keyof typeof statusLabels] ?? "Closed for commissions"}
        </span>
      </div>
    )}

    {profileUser.bio && (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-1">Bio</p>
        <p className="text-sm text-white/70">{profileUser.bio}</p>
      </div>
    )}

    {(profileUser.websiteUrl || profileUser.twitterHandle || profileUser.instagramHandle || profileUser.artstationHandle) && (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Links</p>
        <div className="flex flex-col gap-2">
          {profileUser.websiteUrl && (
            <a href={profileUser.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
              <span>🌐</span> {profileUser.websiteUrl}
            </a>
          )}
          {profileUser.twitterHandle && (
            <a href={`https://x.com/${profileUser.twitterHandle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
              <span>𝕏</span> {profileUser.twitterHandle}
            </a>
          )}
          {profileUser.instagramHandle && (
            <a href={`https://instagram.com/${profileUser.instagramHandle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
              <span>📸</span> {profileUser.instagramHandle}
            </a>
          )}
          {profileUser.artstationHandle && (
            <a href={`https://artstation.com/${profileUser.artstationHandle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
              <span>🎨</span> ArtStation — {profileUser.artstationHandle}
            </a>
          )}
        </div>
      </div>
    )}

    {isOwn && (
      <Link href="/settings" className="mt-2 text-sm text-cyan-400 hover:underline">
        Edit profile →
      </Link>
    )}
  </div>
)}
```

- [ ] **Step 3: Remove commission status badge from the header**

In the header section, remove this block (it was around lines 220–226):
```tsx
{profileUser.sellingEnabled && (
  <div className="mt-3">
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[profileUser.commissionStatus as keyof typeof statusColors] ?? "bg-white/10 text-white/30"}`}>
      {statusLabels[profileUser.commissionStatus as keyof typeof statusLabels] ?? "Closed for commissions"}
    </span>
  </div>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: redesigned commissions tab and updated about tab with status badge"
```

---

### Task 9: Smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test profile header**

Visit your own profile — should show follower count, following count, "Edit profile" button, no commission badge in header.
Visit another user's profile (create a second test account if needed) — should show Follow button, Message button, follower/following counts, mutual followers count if any.

- [ ] **Step 3: Test mutual followers modal**

Follow a user from account A. Log into account B and also follow that same user. Visit account A's profile from account B — mutual count should show 1. Tapping it should open modal with the shared follower.

- [ ] **Step 4: Test tab visibility**

Set your commission status to CLOSED in Artist Dashboard. Visit your profile from another account — Commissions tab should be hidden.
Remove all shop items. Visit from another account — Shop tab should be hidden.
Both tabs always visible on own profile.

- [ ] **Step 5: Test pinning**

On your own profile, open a post. Should see "Pin" button alongside "Delete".
Pin a post — it should jump to the top of the grid with a pin icon visible.
Pin 3 posts. Try to pin a 4th — should show error "You can only pin up to 3 posts."
View same profile from another account — pinned posts at top but no pin icon visible.

- [ ] **Step 6: Test Commissions tab**

Visit an artist profile with OPEN status. Commissions tab should show the info card (description, turnaround, price ranges, New Artist trust score badge, Request Commission button) and example work gallery using their commission card images.
Request Commission button should open the request modal.

- [ ] **Step 7: Test About tab**

Should show commission status badge, bio, social links. No commission badge in header.

- [ ] **Step 8: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: profile redesign smoke test fixes"
```
