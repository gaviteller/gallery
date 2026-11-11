"use client"
/**
 * ARTIST PROFILE (Codex redesign). Styling: app/redesign/profile.css (generated).
 * All data is real: profile, posts, shop listings, commission settings, trust score,
 * follow/mutuals, block, stories. Creating posts uses the shell's Create dialog.
 */
import "../redesign/profile.css"
import "../redesign/shell.css"
import { useState, use, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight, Check, ChevronDown, ImageIcon, MessageCircle, MoreHorizontal, Plus, Pin, ShoppingBag, Paintbrush, Globe } from "lucide-react"
import { trpc } from "@/components/providers"
import ReportModal from "@/components/ReportModal"
import CommissionRequestModal from "@/components/CommissionRequestModal"
import StoryViewer from "@/components/StoryViewer"
import StoryUpload from "@/components/StoryUpload"
import ShopListingModal from "@/components/ShopListingModal"
import RedesignShell, { GallerySidebar, Avatar, useShell } from "@/components/redesign/RedesignShell"
import { TIER_LABELS, TIER_COLORS } from "@/server/lib/trustScore"

const TABS = ["Portfolio", "Shop", "Commissions", "About"] as const
type Tab = typeof TABS[number]
const FILTERS = ["All", "Original", "AI-generated", "Commissions"] as const
type Filter = typeof FILTERS[number]

type PostItem = {
  id: string; image: string; title: string | null; description: string | null
  isAiGenerated: boolean; isCommission: boolean; pinned: boolean; createdAt: Date | string
  status: string; removalReason?: string | null
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(n)
}

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: rawUsername } = use(params)
  const decoded = decodeURIComponent(rawUsername)
  const username = decoded.startsWith("@") ? decoded.slice(1) : decoded
  return (
    <RedesignShell wrapperClass="gx-profile">
      <div className="desktop-layout profile-layout">
        <GallerySidebar />
        <ProfileBody username={username} />
      </div>
    </RedesignShell>
  )
}

function ProfileBody({ username }: { username: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const { openCreate } = useShell()
  const utils = trpc.useUtils()

  const { data: profileUser, isLoading: userLoading } = trpc.user.getByUsername.useQuery({ username })
  const { data: posts, isLoading: postsLoading } = trpc.post.getByUsername.useQuery({ username, viewerUserId: session?.user?.id })
  const { data: shopItems, isLoading: shopLoading } = trpc.shop.getByUsername.useQuery({ username })
  const { data: commissionProfile } = trpc.commission.getProfile.useQuery({ username })
  const { data: trustScore } = trpc.commission.getTrustScore.useQuery({ username })
  const { data: approvedWork } = trpc.commission.getApprovedWork.useQuery({ username })
  const { data: commissionCategories } = trpc.commission.getCategories.useQuery({ username })
  const { data: followStatus, refetch: refetchFollow } = trpc.follow.status.useQuery({ username }, { enabled: !!profileUser })
  const { data: mutualData } = trpc.follow.mutuals.useQuery({ username }, { enabled: !!profileUser && !!session && session.user.id !== profileUser?.id })
  const followMutation = trpc.follow.follow.useMutation({ onSuccess: () => refetchFollow() })
  const unfollowMutation = trpc.follow.unfollow.useMutation({ onSuccess: () => refetchFollow() })
  const { data: blockStatus, refetch: refetchBlock } = trpc.block.status.useQuery({ username }, { enabled: !!profileUser && !!session && session?.user?.id !== profileUser?.id })
  const blockToggle = trpc.block.toggle.useMutation({ onSuccess: (data) => { refetchBlock(); if (data.blocked) router.push("/") } })
  const { data: userStories = [] } = trpc.story.getByUsername.useQuery({ username })
  const getOrCreateDM = trpc.dm.getOrCreate.useMutation({ onSuccess: (convo) => router.push(`/messages/${convo.id}`) })
  const deleteShopItem = trpc.shop.delete.useMutation({ onSuccess: () => utils.shop.getByUsername.invalidate({ username }) })

  const [tab, setTab] = useState<Tab>("Portfolio")
  const [filter, setFilter] = useState<Filter>("All")
  const [order, setOrder] = useState<"featured" | "newest" | "oldest">("featured")
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [reportingPostId, setReportingPostId] = useState<string | null>(null)
  const [showCommissionRequest, setShowCommissionRequest] = useState(false)
  const [showMutuals, setShowMutuals] = useState(false)
  const [viewingStory, setViewingStory] = useState(false)
  const [addingStory, setAddingStory] = useState(false)
  const [showShopModal, setShowShopModal] = useState(false)

  useEffect(() => {
    if (!moreMenuOpen && !newMenuOpen) return
    const close = () => { setMoreMenuOpen(false); setNewMenuOpen(false) }
    const timer = setTimeout(() => document.addEventListener("click", close), 0)
    return () => { clearTimeout(timer); document.removeEventListener("click", close) }
  }, [moreMenuOpen, newMenuOpen])

  if (userLoading) return <main className="profile-main"><div className="profile-text-panel">Loading…</div></main>
  if (!profileUser) return <main className="profile-main"><div className="profile-text-panel"><h2>User not found</h2><Link className="profile-secondary" href="/search">Explore artists</Link></div></main>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pu = profileUser as any
  const isOwn = session?.user?.id === profileUser.id
  const displayName = profileUser.name ?? `@${profileUser.username}`
  const commissionsOpen = !!commissionProfile && commissionProfile.commissionStatus !== "CLOSED"
  const galleryImages = [
    ...(approvedWork ?? []).map((w) => ({ src: w.fileUrl, key: `approved-${w.commissionId}` })),
    ...(commissionProfile?.commissionCardImages ?? []).map((img) => ({ src: img, key: `manual-${img}` })),
  ]
  const visibleTabs = TABS.filter((t) => {
    if (isOwn) return true
    if (t === "Shop" && (!shopItems || shopItems.length === 0)) return false
    if (t === "Commissions" && !commissionsOpen) return false
    return true
  })

  const allPosts = (posts ?? []) as PostItem[]
  const filtered = allPosts.filter((p) =>
    filter === "All" ? true : filter === "Original" ? !p.isAiGenerated : filter === "AI-generated" ? p.isAiGenerated : p.isCommission,
  )
  if (order !== "featured") {
    filtered.sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * (order === "newest" ? 1 : -1))
  }

  const busyFollow = followMutation.isPending || unfollowMutation.isPending

  return (
    <main className="profile-main">
      <header className="profile-hero">
        <div className="concept-art profile-cover" style={{ height: "clamp(190px, 24vw, 340px)", background: pu.bannerImage ? `center / cover no-repeat url(${JSON.stringify(pu.bannerImage)})` : "linear-gradient(135deg, #3a2650, #1f2a44 55%, #4a2a3e)" }} role="img" aria-label={`${displayName}'s banner`} />
        <div className="profile-details">
          <button
            className="concept-art profile-portrait"
            style={{ aspectRatio: "1", padding: 0, overflow: "hidden", cursor: isOwn || userStories.length > 0 ? "pointer" : "default" }}
            onClick={() => { if (isOwn) setAddingStory(true); else if (userStories.length > 0) setViewingStory(true) }}
            aria-label={userStories.length > 0 ? `View ${displayName}'s story` : displayName}
          >
            <Avatar src={profileUser.image} name={displayName} className="profile-portrait-img" />
          </button>
          <div className="profile-identity">
            <h1>{displayName}</h1>
            <p className="profile-handle">@{profileUser.username}{pu.sellingEnabled ? " · Artist" : ""}</p>
            {profileUser.bio && <p className="profile-bio">{profileUser.bio}</p>}
            <p className="profile-stats">
              <span><strong>{formatCount(followStatus?.followerCount ?? 0)}</strong> Followers</span>
              <span><strong>{formatCount(followStatus?.followingCount ?? 0)}</strong> Following</span>
              <span><strong>{allPosts.length}</strong> Artworks</span>
              {trustScore && trustScore.finalScore !== null && <span><strong>{trustScore.finalScore.toFixed(1)}</strong> Rating</span>}
            </p>
            {!isOwn && mutualData && mutualData.count > 0 && (
              <button className="query-label" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => setShowMutuals(true)}>
                {mutualData.count} mutual follower{mutualData.count !== 1 ? "s" : ""}
              </button>
            )}
          </div>
          <div className="profile-actions">
            <div style={{ position: "relative" }}>
              {isOwn ? (
                <>
                  <Link className="profile-secondary" href="/settings">Edit profile</Link>
                  <button className="profile-primary" onClick={(e) => { e.stopPropagation(); setNewMenuOpen((v) => !v) }}><Plus size={16} />New</button>
                  {newMenuOpen && (
                    <div className="gx-menu" role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 30 }}>
                      <button role="menuitem" onClick={() => openCreate("Image")}>Post</button>
                      <button role="menuitem" onClick={() => setAddingStory(true)}>Story</button>
                      <button role="menuitem" onClick={() => openCreate("Image")}>Commission post</button>
                      <button role="menuitem" onClick={() => setShowShopModal(true)}>Shop listing</button>
                    </div>
                  )}
                </>
              ) : session ? (
                <>
                  <button className="profile-primary" aria-pressed={!!followStatus?.following} disabled={busyFollow} onClick={() => followStatus?.following ? unfollowMutation.mutate({ username }) : followMutation.mutate({ username })}>
                    {followStatus?.following ? <Check size={16} /> : <Plus size={16} />}{followStatus?.following ? "Following" : "Follow"}
                  </button>
                  <button className="profile-secondary" disabled={getOrCreateDM.isPending} onClick={() => getOrCreateDM.mutate({ otherUserId: profileUser.id })}><MessageCircle size={16} />Message</button>
                  <button className="profile-secondary" aria-label="More options" onClick={(e) => { e.stopPropagation(); setMoreMenuOpen((v) => !v) }}><MoreHorizontal size={16} /></button>
                  {moreMenuOpen && (
                    <div className="gx-menu" role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 30 }}>
                      <button role="menuitem" disabled={blockToggle.isPending} style={{ color: blockStatus?.blocked ? undefined : "#ef6b6b" }} onClick={() => {
                        if (confirm(blockStatus?.blocked ? `Unblock @${username}?` : `Block @${username}? They won't be able to see your profile or posts.`)) blockToggle.mutate({ username })
                      }}>{blockStatus?.blocked ? `Unblock @${username}` : `Block @${username}`}</button>
                    </div>
                  )}
                </>
              ) : (
                <Link className="profile-primary" href={`/signin?callbackUrl=/@${username}`}><Plus size={16} />Follow</Link>
              )}
            </div>
            {commissionProfile && commissionProfile.commissionStatus !== "CLOSED" && (
              <button className="commission-status" onClick={() => setTab("Commissions")}><span style={commissionProfile.commissionStatus === "LIMITED" ? { background: "#f2c14e" } : undefined} />{commissionProfile.commissionStatus === "LIMITED" ? "Limited commission slots" : "Commissions open"}</button>
            )}
          </div>
        </div>
      </header>

      <nav className="profile-tabs" aria-label="Artist profile sections">
        {visibleTabs.map((item) => <button key={item} aria-pressed={tab === item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{item}</button>)}
      </nav>

      {tab === "Portfolio" && (
        <section aria-labelledby="selected-work">
          <div className="portfolio-toolbar">
            <h2 id="selected-work">Selected Work</h2>
            <div className="portfolio-filters" aria-label="Filter artwork">
              {FILTERS.map((item) => <button key={item} aria-pressed={filter === item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
            <label className="portfolio-sort"><span className="sr-only">Sort artwork</span>
              <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)}><option value="featured">Featured</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select><ChevronDown size={13} />
            </label>
          </div>
          {postsLoading ? <div className="profile-text-panel">Loading…</div> : (
            <div className="portfolio-grid">
              {filtered.map((post) => {
                const removed = post.status === "REMOVED"
                const caption = post.title || post.description || "Untitled"
                return (
                  <article className="portfolio-card" key={post.id}>
                    <Link className="artwork-button" href={removed ? "#" : `/@${username}/${post.id}`} onClick={(e) => { if (removed) e.preventDefault() }} aria-label={`View ${caption}`} style={{ position: "relative" }}>
                      <img className="portfolio-image" src={post.image} alt={post.description ?? caption} style={{ aspectRatio: "1" }} />
                      <span className="artwork-open"><ArrowUpRight size={17} /></span>
                      {post.status === "PENDING_REVIEW" && <span className="gx-post-overlay">Under review</span>}
                      {isOwn && removed && (
                        <span className="gx-post-overlay removed">
                          Removed{post.removalReason ? ` — ${post.removalReason}` : ""}
                          <a href={`/appeal?postId=${post.id}`} onClick={(e) => e.stopPropagation()}>Appeal →</a>
                        </span>
                      )}
                    </Link>
                    <div className="artwork-caption">
                      <div>
                        <h3>{caption.length > 48 ? caption.slice(0, 48) + "…" : caption}</h3>
                        <p>{[post.isAiGenerated ? "AI-generated" : "Original", post.isCommission ? "Commission" : null, new Date(post.createdAt).getFullYear()].filter(Boolean).join(" · ")}</p>
                      </div>
                      {isOwn && post.pinned && <span className="icon-button" title="Pinned"><Pin size={15} /></span>}
                      {!isOwn && session && !removed && <button className="icon-button" aria-label="Report artwork" title="Report" onClick={() => setReportingPostId(post.id)}><MoreHorizontal size={16} /></button>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {!postsLoading && !filtered.length && (
            <div className="profile-text-panel">
              <ImageIcon size={22} />
              <h2>{allPosts.length ? "No matching artwork" : "No posts yet"}</h2>
              {allPosts.length ? <button className="profile-secondary" onClick={() => setFilter("All")}>Show all</button> : isOwn && <button className="profile-primary" onClick={() => openCreate("Image")}>Share your first piece<ArrowUpRight size={16} /></button>}
            </div>
          )}
        </section>
      )}

      {tab === "Shop" && (
        <section>
          <div className="portfolio-toolbar">
            <h2>{isOwn ? "Your Shop" : `${profileUser.name ?? profileUser.username}’s Shop`}</h2>
            <div className="portfolio-filters">
              <Link href={`/@${profileUser.username}/shop`} className="is-active" style={{ textDecoration: "none" }}>Browse all</Link>
              {isOwn && <Link href={`/@${profileUser.username}/shop/new`} style={{ textDecoration: "none" }}>+ Add listing</Link>}
            </div>
          </div>
          {shopLoading ? <div className="profile-text-panel">Loading…</div> : shopItems && shopItems.length > 0 ? (
            <div className="portfolio-grid">
              {shopItems.map((item) => (
                <article className="portfolio-card" key={item.id}>
                  <Link className="artwork-button" href={`/@${profileUser.username}/shop/${item.id}`}><img className="portfolio-image" src={item.image} alt={item.title} style={{ aspectRatio: "1" }} /></Link>
                  <div className="artwork-caption">
                    <div><h3>{item.title}</h3><p>${item.price.toFixed(2)}</p></div>
                    {isOwn
                      ? <button className="icon-button" style={{ color: "#ef6b6b", width: "auto", padding: "0 8px", fontSize: 11 }} disabled={deleteShopItem.isPending} onClick={() => { if (confirm(`Remove “${item.title}” from your shop?`)) deleteShopItem.mutate({ id: item.id }) }}>Remove</button>
                      : <Link className="icon-button" aria-label={`View ${item.title}`} href={`/@${profileUser.username}/shop/${item.id}`}><ShoppingBag size={16} /></Link>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="profile-text-panel"><ShoppingBag size={22} /><h2>No items for sale yet</h2>{isOwn && <p>Add prints, stickers, or other work.</p>}</div>
          )}
        </section>
      )}

      {tab === "Commissions" && (
        <section>
          {!commissionProfile ? <div className="profile-text-panel">Loading…</div> : (
            <>
              <div className="profile-text-panel">
                <span className="eyebrow">{({ OPEN: "COMMISSIONS OPEN", LIMITED: "LIMITED SLOTS", CLOSED: "COMMISSIONS CLOSED" } as Record<string, string>)[commissionProfile.commissionStatus] ?? "COMMISSIONS CLOSED"}</span>
                <h2>Commission {profileUser.name ?? `@${profileUser.username}`}</h2>
                {trustScore && (
                  <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: TIER_COLORS[trustScore.tier], display: "inline-block" }} />
                    <span style={{ color: TIER_COLORS[trustScore.tier], fontWeight: 700 }}>{TIER_LABELS[trustScore.tier]}</span>
                    {trustScore.finalScore !== null && <span>{trustScore.finalScore.toFixed(1)} trust score</span>}
                  </p>
                )}
                {commissionProfile.commissionDescription && <p>{commissionProfile.commissionDescription}</p>}
                {commissionProfile.commissionTurnaround && <p>Turnaround: <strong>{commissionProfile.commissionTurnaround}</strong></p>}
                {Array.isArray(commissionProfile.priceRanges) && (commissionProfile.priceRanges as { label: string; price: number }[]).length > 0 && (
                  <p>{(commissionProfile.priceRanges as { label: string; price: number }[]).map((r) => `${r.label} — $${r.price}`).join(" · ")}</p>
                )}
                {!isOwn && commissionsOpen && session && commissionCategories && (
                  <button className="profile-primary" onClick={() => setShowCommissionRequest(true)}>Request a commission<ArrowUpRight size={16} /></button>
                )}
                {isOwn && <Link className="profile-secondary" href="/professional-profile">Manage in Dashboard</Link>}
              </div>
              {galleryImages.length > 0 ? (
                <>
                  <div className="portfolio-toolbar"><h2>Example work</h2></div>
                  <div className="portfolio-grid">
                    {galleryImages.map(({ src, key }) => <article className="portfolio-card" key={key}><img className="portfolio-image" src={src} alt="Example commission work" style={{ aspectRatio: "1" }} /></article>)}
                  </div>
                </>
              ) : (
                <div className="profile-text-panel"><Paintbrush size={22} /><h2>No example work yet</h2>{isOwn && <p>Add images in your Artist Dashboard.</p>}</div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "About" && (
        <section className="profile-text-panel">
          <h2>About {profileUser.name ?? `@${profileUser.username}`}</h2>
          {profileUser.bio ? <p>{profileUser.bio}</p> : <p>No bio yet.</p>}
          {(pu.websiteUrl || pu.twitterHandle || pu.instagramHandle || pu.artstationHandle) && (
            <p style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {pu.websiteUrl && <a href={pu.websiteUrl} target="_blank" rel="noopener noreferrer"><Globe size={13} /> {pu.websiteUrl}</a>}
              {pu.twitterHandle && <a href={`https://x.com/${pu.twitterHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">X · {pu.twitterHandle}</a>}
              {pu.instagramHandle && <a href={`https://instagram.com/${pu.instagramHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">Instagram · {pu.instagramHandle}</a>}
              {pu.artstationHandle && <a href={`https://artstation.com/${pu.artstationHandle}`} target="_blank" rel="noopener noreferrer">ArtStation · {pu.artstationHandle}</a>}
            </p>
          )}
          {isOwn && <Link className="profile-secondary" href="/settings">Edit profile</Link>}
        </section>
      )}

      {showCommissionRequest && commissionProfile && commissionCategories && (
        <CommissionRequestModal artistId={commissionProfile.id} artistUsername={username} categories={commissionCategories} onClose={() => setShowCommissionRequest(false)} />
      )}
      {showMutuals && !isOwn && mutualData && (
        <div className="gx-sheet-backdrop" onClick={() => setShowMutuals(false)}>
          <div className="gx-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Mutual followers</h2>
            {mutualData.users.map((u) => (
              <button key={u.id} className="gx-sheet-row" onClick={() => { setShowMutuals(false); router.push(`/@${u.username}`) }}>
                <Avatar src={u.image} name={u.name ?? u.username ?? "?"} /><span><strong>@{u.username}</strong>{u.name && <small>{u.name}</small>}</span>
              </button>
            ))}
            {mutualData.users.length === 0 && <p>No mutual followers</p>}
          </div>
        </div>
      )}
      {viewingStory && userStories.length > 0 && (
        <StoryViewer user={{ userId: profileUser.id, username: profileUser.username, name: profileUser.name, image: profileUser.image, stories: userStories }} onClose={() => setViewingStory(false)} />
      )}
      {addingStory && <StoryUpload onClose={() => setAddingStory(false)} onSuccess={() => setAddingStory(false)} />}
      {showShopModal && <ShopListingModal username={username} onClose={() => setShowShopModal(false)} />}
      {reportingPostId && <ReportModal postId={reportingPostId} onClose={() => setReportingPostId(null)} onReported={() => setReportingPostId(null)} />}
    </main>
  )
}
