# Optimistic Like Button — Design Spec

Date: 2026-05-27

---

## Goal

Make the like button on the main feed feel instant. Right now it fires a mutation and waits for the server round-trip before the heart fills and the count updates. With optimistic updates the UI flips immediately and rolls back silently if the server fails.

---

## Current State

In `app/page.tsx`:

```ts
const toggleLike = trpc.interaction.toggleLike.useMutation({
  onSuccess: () => utils.post.getFeed.invalidate(),
})
```

The feed is an **infinite query** (`trpc.post.getFeed.useInfiniteQuery`). `invalidate()` re-fetches every loaded page, causing a noticeable delay and scroll jump.

---

## Approach

Use tRPC's React Query `onMutate` / `onError` / `onSettled` hooks to:

1. **`onMutate`**: Cancel in-flight refetches, snapshot current cache, apply optimistic update to the infinite query cache — flip `likedByMe` and ±1 `_count.likes` for the target post across all pages.
2. **`onError`**: Roll back to the snapshot.
3. **`onSettled`**: Invalidate the query so the cache eventually syncs with the server (handles edge cases like the server returning a different state than expected).

No changes to the server router. No new files. One self-contained change in `app/page.tsx`.

---

## Implementation

Replace the existing `toggleLike` mutation with:

```ts
const toggleLike = trpc.interaction.toggleLike.useMutation({
  onMutate: async ({ postId }) => {
    // Cancel any in-flight refetch so it doesn't overwrite our optimistic update
    await utils.post.getFeed.cancel()

    // Snapshot the current cache
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
    // Sync with server after mutation completes (success or failure)
    utils.post.getFeed.invalidate()
  },
})
```

---

## Type Safety

The infinite query key for `getFeed` is `{}` (empty input object). The `setInfiniteData` call uses the same key. The post type returned by `getFeed` includes `likedByMe: boolean` and `_count: { likes: number; comments: number }`, so the optimistic update is fully typed.

---

## Files

**Modify:**
- `app/page.tsx` — replace `toggleLike` mutation (the `onSuccess: invalidate` version) with the optimistic version above

---

## Behaviour

| Event | What happens |
|---|---|
| User taps heart | Heart fills / unfills instantly, count ±1 |
| Server succeeds | `onSettled` invalidates → background sync (no visible change expected) |
| Server fails (network error, banned, etc.) | Heart/count rolls back to pre-tap state silently |
| Multiple rapid taps | Each tap cancels in-flight refetch and re-snapshots; final state syncs on last `onSettled` |

---

## Out of Scope

- Optimistic like on the profile page grid (low traffic interaction, not worth the complexity)
- Optimistic comment like (much less frequent)
- Debouncing rapid taps (React Query handles concurrent mutations fine)
