# Optimistic Like Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the like button on the main feed feel instant by applying the toggle optimistically instead of waiting for the server round-trip.

**Architecture:** Replace the current `onSuccess: invalidate` pattern in `app/page.tsx` with an `onMutate` / `onError` / `onSettled` triple that snaps the `likedByMe` flag and `_count.likes` immediately in the React Query infinite cache, rolls back on error, then syncs with the server in the background.

**Tech Stack:** Next.js App Router, tRPC v11, React Query `useInfiniteQuery` cache manipulation (TypeScript)

---

## File Map

| File | Change |
|---|---|
| `app/page.tsx` | Replace `toggleLike` mutation — add `onMutate`, `onError`, `onSettled`; remove standalone `onSuccess` |

No other files change.

---

### Task 1: Optimistic Like Mutation

**Files:**
- Modify: `app/page.tsx` (the `toggleLike` mutation, roughly lines 68–70)

- [ ] **Step 1: Find the current mutation**

Open `app/page.tsx`. Find this block (currently around line 68):

```ts
const toggleLike = trpc.interaction.toggleLike.useMutation({
  onSuccess: () => utils.post.getFeed.invalidate(),
})
```

- [ ] **Step 2: Replace with the optimistic version**

Replace the entire `toggleLike` const with:

```ts
const toggleLike = trpc.interaction.toggleLike.useMutation({
  onMutate: async ({ postId }) => {
    // Cancel any in-flight refetch so it doesn't overwrite our optimistic update
    await utils.post.getFeed.cancel()

    // Snapshot the current cache so we can roll back on error
    const previous = utils.post.getFeed.getInfiniteData({})

    // Optimistically update the cache
    utils.post.getFeed.setInfiniteData({}, (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.map((post) => {
            if (post.id !== postId) return post
            const wasLiked = post.likedByMe
            return {
              ...post,
              likedByMe: !wasLiked,
              _count: {
                ...post._count,
                likes: post._count.likes + (wasLiked ? -1 : 1),
              },
            }
          }),
        })),
      }
    })

    return { previous }
  },

  onError: (_err, _input, context) => {
    // Roll back to the snapshot on failure
    if (context?.previous) {
      utils.post.getFeed.setInfiniteData({}, context.previous)
    }
  },

  onSettled: () => {
    // Background sync with server after mutation completes
    utils.post.getFeed.invalidate()
  },
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `toggleLike` or `getFeed`.

- [ ] **Step 4: Run the dev server and manually test**

```bash
npm run dev
```

1. Open `http://localhost:3000`
2. Click the heart on any post — the heart and count should flip **immediately** without any loading delay
3. Click it again — it should flip back immediately
4. Open Network tab in DevTools — confirm the request is still sent, but the UI doesn't wait for the response

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: optimistic like button on main feed"
```
