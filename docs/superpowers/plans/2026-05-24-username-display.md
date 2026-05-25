# Username Primary Display + Real Name Privacy Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@username` the primary public identity on profiles, with real name shown only when the user explicitly opts in via a settings toggle.

**Architecture:** One new DB column (`showRealName Boolean @default(false)`) drives everything. The profile page always shows `@username` as the headline; real name appears as a subtitle only when `showRealName === true` and `name` is non-empty. A toggle in Settings saves immediately (no form save needed). The `getByUsername` and `me` procedures already return the full User object with no `select`, so they pick up the new field automatically once the schema is updated.

**Tech Stack:** Prisma 5 migrations, tRPC v11 (protectedProcedure), Next.js 16 App Router, React 19, Vitest.

---

## File Structure

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `showRealName Boolean @default(false)` to User model |
| `prisma/migrations/20260524010000_add_show_real_name/migration.sql` | CREATE: raw SQL for the column |
| `server/routers/user.ts` | Add `updateShowRealName` mutation |
| `tests/server/user.test.ts` | Add tests for the new mutation |
| `app/settings/page.tsx` | Add toggle UI + state + immediate-save mutation |
| `app/[username]/page.tsx` | Swap h1/subtitle: `@username` as headline, name as optional subtitle |
| `prisma/schema.prisma` in gallery-admin | Copy updated schema so gallery-admin generates correctly |

---

### Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260524010000_add_show_real_name/migration.sql`
- Modify: `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\prisma\schema.prisma`

- [ ] **Step 1: Add `showRealName` to the User model in `prisma/schema.prisma`**

Find the `bannerImage` line (currently around line 70) and add `showRealName` directly after it:

```prisma
  bannerImage               String?          @db.Text
  showRealName              Boolean          @default(false)
```

The full User model block around that area will look like:

```prisma
  bannedUntil               DateTime?
  banReason                 String?
  bannerImage               String?          @db.Text
  showRealName              Boolean          @default(false)

  websiteUrl       String?
```

- [ ] **Step 2: Create the migration directory and SQL file**

Create directory: `prisma/migrations/20260524010000_add_show_real_name/`

Create file `prisma/migrations/20260524010000_add_show_real_name/migration.sql` with this content:

```sql
-- AddColumn
ALTER TABLE "User" ADD COLUMN "showRealName" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Apply the migration to Neon**

Run from `C:\Users\gavri\OneDrive\Documents\Projects\gallery`:

```
npx prisma migrate deploy
```

Expected output includes:
```
1 migration found in prisma/migrations
Applying migration `20260524010000_add_show_real_name`
The following migration have been applied:
  migrations/
    └─ 20260524010000_add_show_real_name/
      └─ migration.sql
```

- [ ] **Step 4: Regenerate the Prisma client**

```
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Copy updated schema to gallery-admin**

Open `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\prisma\schema.prisma` and add the same line after `bannerImage`:

```prisma
  bannerImage               String?          @db.Text
  showRealName              Boolean          @default(false)
```

Then run from gallery-admin:

```
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260524010000_add_show_real_name/migration.sql
git commit -m "feat: add showRealName column to User"
```

---

### Task 2: tRPC Mutation + Tests

**Files:**
- Modify: `server/routers/user.ts`
- Modify: `tests/server/user.test.ts`

- [ ] **Step 1: Write the failing test in `tests/server/user.test.ts`**

Add this block at the end of the file:

```typescript
describe("user.updateShowRealName", () => {
  it("sets showRealName to true", async () => {
    const updated = { id: "user-1", showRealName: true }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.updateShowRealName({ showRealName: true })
    expect(result.showRealName).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { showRealName: true },
      select: { id: true, showRealName: true },
    })
  })

  it("sets showRealName to false", async () => {
    const updated = { id: "user-1", showRealName: false }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.updateShowRealName({ showRealName: false })
    expect(result.showRealName).toBe(false)
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    const unauthCaller = getCaller(null as any)
    await expect(
      unauthCaller.user.updateShowRealName({ showRealName: true })
    ).rejects.toThrow("UNAUTHORIZED")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```
npx vitest run tests/server/user.test.ts
```

Expected: FAIL — `user.updateShowRealName is not a function` or similar.

- [ ] **Step 3: Add `updateShowRealName` to `server/routers/user.ts`**

Add this mutation before the closing `})` of the `userRouter`:

```typescript
  updateShowRealName: protectedProcedure
    .input(z.object({ showRealName: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { showRealName: input.showRealName },
        select: { id: true, showRealName: true },
      })
    }),
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run tests/server/user.test.ts
```

Expected: all tests pass including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add server/routers/user.ts tests/server/user.test.ts
git commit -m "feat: add updateShowRealName tRPC mutation"
```

---

### Task 3: Settings Page Toggle

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Add the `showRealName` state and initialize it from server data**

In `SettingsForm`, add state after the `artstationHandle` state (around line 38):

```typescript
const [showRealName, setShowRealName] = useState(false)
```

In the `useEffect` that initializes from `user` (around line 44), add one line:

```typescript
useEffect(() => {
  if (user) {
    setName(user.name ?? "")
    setBio(user.bio ?? "")
    setImage(user.image ?? null)
    setBannerImage((user as { bannerImage?: string | null }).bannerImage ?? null)
    setWebsiteUrl(user.websiteUrl ?? "")
    setTwitterHandle(user.twitterHandle ?? "")
    setInstagramHandle(user.instagramHandle ?? "")
    setArtstationHandle(user.artstationHandle ?? "")
    setShowRealName((user as { showRealName?: boolean }).showRealName ?? false)
  }
}, [user])
```

- [ ] **Step 2: Add the mutation**

Add after the existing `updateSelling` mutation (around line 70):

```typescript
const updateShowRealName = trpc.user.updateShowRealName.useMutation({
  onSuccess: () => utils.user.me.invalidate(),
})
```

- [ ] **Step 3: Add the toggle UI in the profile tab**

Find the "Name" `<div>` block in the profile tab (around line 258):

```tsx
{/* Name */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
  <input
    type="text"
    value={name}
    onChange={(e) => setName(e.target.value)}
    maxLength={100}
    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>
```

Replace it with:

```tsx
{/* Name */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
  <input
    type="text"
    value={name}
    onChange={(e) => setName(e.target.value)}
    maxLength={100}
    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  {user?.name && (
    <div className="flex items-center justify-between mt-3">
      <div>
        <p className="text-sm font-medium text-gray-700">Show my real name on my profile</p>
        <p className="text-xs text-gray-400 mt-0.5">When on, your real name appears on your public profile page.</p>
      </div>
      <button
        onClick={() => {
          const next = !showRealName
          setShowRealName(next)
          updateShowRealName.mutate({ showRealName: next })
        }}
        disabled={updateShowRealName.isPending}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
          showRealName ? "bg-blue-600" : "bg-gray-200"
        }`}
        role="switch"
        aria-checked={showRealName}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showRealName ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 4: Verify the settings page compiles**

```
npx tsc --noEmit
```

Expected: no errors relating to `showRealName` or `updateShowRealName`.

- [ ] **Step 5: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: add show real name toggle to settings"
```

---

### Task 4: Profile Page Display

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Swap the h1 and subtitle in the profile page**

Find the "Name" comment block (around line 297):

```tsx
        {/* Name */}
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, color: "white", lineHeight: 1.2 }}>
          {profileUser.name ?? profileUser.username}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 2 }}>@{profileUser.username}</p>
```

Replace it with:

```tsx
        {/* Name */}
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, color: "white", lineHeight: 1.2 }}>
          @{profileUser.username}
        </h1>
        {(profileUser as { showRealName?: boolean; name?: string | null }).showRealName &&
          profileUser.name && (
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 2 }}>{profileUser.name}</p>
        )}
```

- [ ] **Step 2: Verify the profile page compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start the dev server: `npm run dev`

Visit `http://localhost:3000/<your-username>` in a browser.

- Profile h1 should now show `@username` (not the real name)
- Real name subtitle should NOT appear (since `showRealName` defaults to `false`)

Go to Settings → Profile tab. If you have a Display name set, the "Show my real name on my profile" toggle appears. Toggle it on, go back to the profile — real name now shows below the username.

- [ ] **Step 4: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: username as primary profile display, real name opt-in"
```
