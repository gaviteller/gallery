"use client"
/**
 * HOME FEED (Codex redesign). Layout/styling: app/redesign/feed.css (generated).
 * Data: trpc.post.getFeed — ranked once per page open (asOf), loaded 12 at a time.
 */
import "./redesign/feed.css"
import "./redesign/shell.css"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"
import { ArrowDownWideNarrow, Sparkles } from "lucide-react"
import { trpc } from "@/components/providers"
import PostModal from "@/components/PostModal"
import ReportModal from "@/components/ReportModal"
import RedesignShell, { GallerySidebar } from "@/components/redesign/RedesignShell"
import { StoriesPanel, FeedPost, FeedRightRail, type FeedPostData } from "@/components/redesign/FeedParts"
import AdCard, { useAds } from "@/components/redesign/AdCard"

export default function FeedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
    if (status === "authenticated" && (!session.user.onboardingComplete || !session.user.username)) router.push("/onboarding")
  }, [status, session, router])

  if (status !== "authenticated") return null
  return (
    <RedesignShell wrapperClass="gx-feed">
      <div className="desktop-layout">
        <GallerySidebar note={"Good things start\nwith a little spark."} />
        <FeedColumn />
        <FeedRightRail />
      </div>
    </RedesignShell>
  )
}

function FeedColumn() {
  const utils = trpc.useUtils()
  const [openPost, setOpenPost] = useState<FeedPostData | null>(null)
  const [reportingPostId, setReportingPostId] = useState<string | null>(null)
  const [mostLovedFirst, setMostLovedFirst] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Ranking is frozen to when the page opened so it doesn't reshuffle while scrolling or liking.
  const [feedSnapshotTime] = useState(() => Date.now())
  const feedQueryInput = { asOf: feedSnapshotTime }
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.post.getFeed.useInfiniteQuery(
    feedQueryInput,
    { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined, initialCursor: 0, staleTime: Infinity, refetchOnWindowFocus: false },
  )

  // Likes update on screen instantly and roll back if the server rejects them.
  const toggleLike = trpc.interaction.toggleLike.useMutation({
    onMutate: async ({ postId }) => {
      await utils.post.getFeed.cancel()
      const previous = utils.post.getFeed.getInfiniteData(feedQueryInput)
      utils.post.getFeed.setInfiniteData(feedQueryInput, (old) => old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.map((post) => post.id !== postId ? post : {
            ...post,
            likedByMe: !post.likedByMe,
            _count: { ...post._count, likes: post._count.likes + (post.likedByMe ? -1 : 1) },
          }),
        })),
      })
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.post.getFeed.setInfiniteData(feedQueryInput, context.previous)
    },
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
      { rootMargin: "400px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const posts = (data?.pages.flatMap((page) => page.posts) ?? []) as FeedPostData[]
  const shownPosts = mostLovedFirst ? [...posts].sort((a, b) => b._count.likes - a._count.likes) : posts
  const feedAds = useAds("FEED")
  const adEvery = Math.max(3, feedAds[0]?.frequency ?? 8)
  // Ad goes after every `adEvery` posts. A short feed still gets one, after the 2nd post (or the last).
  const adSlots = new Map<number, number>() // post index → which ad to show before it
  if (feedAds.length) {
    if (shownPosts.length > adEvery) for (let i = adEvery, n = 0; i < shownPosts.length; i += adEvery, n++) adSlots.set(i, n % feedAds.length)
    else if (shownPosts.length) adSlots.set(Math.min(2, shownPosts.length), 0)
  }

  return (
    <main className="feed">
      <StoriesPanel />
      <div className="post-stream" aria-label="Scrollable post stream">
        <div className="feed-sort">
          <span>From your creative world</span>
          <button onClick={() => setMostLovedFirst(!mostLovedFirst)}><ArrowDownWideNarrow size={14} />{mostLovedFirst ? "Most loved" : "For you"}</button>
        </div>
        {isLoading && <div className="end-note">Loading…</div>}
        {error && <div className="empty panel"><h2>Couldn’t load the feed.</h2><p>{error.message}</p></div>}
        {!isLoading && !error && posts.length === 0 && (
          <div className="empty panel"><Sparkles /><h2>No artwork yet.</h2><p>Follow artists from Explore to fill your feed.</p></div>
        )}
        {shownPosts.map((post, index) => (
          <Fragment key={post.id}>
          {adSlots.has(index) && <AdCard ad={feedAds[adSlots.get(index)!]} />}
          <FeedPost
            post={post}
            onLike={() => toggleLike.mutate({ postId: post.id })}
            onOpen={() => setOpenPost(post)}
            onReport={() => setReportingPostId(post.id)}
          />
          </Fragment>
        ))}
        {adSlots.has(shownPosts.length) && <AdCard ad={feedAds[adSlots.get(shownPosts.length)!]} />}
        <div ref={sentinelRef} />
        {isFetchingNextPage && <div className="end-note">Loading more…</div>}
        {!hasNextPage && posts.length > 0 && <div className="end-note">You’re all caught up. Go make something beautiful. ✦</div>}
      </div>

      {reportingPostId && (
        <ReportModal
          postId={reportingPostId}
          onClose={() => setReportingPostId(null)}
          onReported={() => { setReportingPostId(null); utils.post.getFeed.invalidate() }}
        />
      )}
      {openPost && (
        <PostModal
          post={{ ...openPost, pinned: false }}
          profileUser={{ username: openPost.user.username, name: openPost.user.name, image: openPost.user.image }}
          isOwn={openPost.isOwnPost}
          autoFocusComment
          onClose={() => setOpenPost(null)}
          onDelete={() => { utils.post.getFeed.invalidate(); setOpenPost(null) }}
        />
      )}
    </main>
  )
}
