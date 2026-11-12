"use client"
/**
 * Shared frame for the redesigned pages (Codex designs): header, sidebar, phone
 * bottom bar, the "Create Post" dialog and toasts — all wired to real data.
 * Each page wraps its content in <RedesignShell> and places <GallerySidebar/>
 * inside its own layout grid. Styling comes from the page's scoped CSS (app/redesign/*.css).
 */
import { addNewPost } from "@/lib/new-posts"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Search, Bell, Menu, House, ShoppingBag, Brush, Compass, MessageCircle, LayoutDashboard, User, Plus, ArrowUpRight, X, ImagePlus, Sparkles } from "lucide-react"
import { trpc } from "@/components/providers"
import GalleryLogo from "./GalleryLogo"
import GalleryPaintDrips from "./GalleryPaintDrips"
import { getActiveTheme, galleryThemes, type PaintTheme } from "./galleryThemes"
import { NotificationPanel } from "@/components/GalleryDesktopSidebar"
import StoryUpload from "@/components/StoryUpload"
import { applyWatermark } from "@/lib/watermark"
import { uploadImage } from "@/lib/upload"

type ShellContext = {
  theme: PaintTheme
  openCreate: (mode?: "Image" | "Story") => void
  toast: (message: string) => void
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  me: { username: string; name: string; image: string | null } | null
}
const Shell = createContext<ShellContext | null>(null)
export function useShell() {
  const value = useContext(Shell)
  if (!value) throw new Error("useShell must be used inside <RedesignShell>")
  return value
}

/** Initials avatar when a user has no photo. */
export function Avatar({ src, name, className = "avatar" }: { src: string | null | undefined; name: string; className?: string }) {
  if (src) return <img className={className} src={src} alt={name} />
  return <span className={`${className} gx-avatar-fallback`} aria-label={name}>{(name || "?")[0].toUpperCase()}</span>
}

/** Resizes an image file so its longest side is at most `maxSize`, returning a JPEG data URL. */
function resizeImage(file: File, maxSize = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read file"))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("Not an image"))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.9))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function RedesignShell({ wrapperClass, children }: { wrapperClass: string; children: React.ReactNode }) {
  const { data: session } = useSession()
  const [theme, setTheme] = useState(galleryThemes[0])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createMode, setCreateMode] = useState<"Image" | "Story" | null>(null)
  const [toastMessage, setToastMessage] = useState("")
  const { data: account } = trpc.user.me.useQuery(undefined, { enabled: !!session })

  useEffect(() => {
    const update = () => setTheme(getActiveTheme())
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(""), 3500)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const me = account?.username
    ? { username: account.username, name: account.name ?? account.username, image: account.image ?? null }
    : null

  const context: ShellContext = {
    theme, drawerOpen, setDrawerOpen, me,
    openCreate: (mode = "Image") => setCreateMode(mode),
    toast: setToastMessage,
  }

  return (
    <Shell.Provider value={context}>
      <div className={`gx ${wrapperClass}`}>
        <GalleryHeader />
        {children}
        <MobileBottomNav />
        {createMode === "Image" && <CreatePostDialog onClose={() => setCreateMode(null)} onStory={() => setCreateMode("Story")} />}
        {toastMessage && <div role="status" className="toast">✦ {toastMessage}</div>}
      </div>
      {createMode === "Story" && (
        <StoryUpload onClose={() => setCreateMode(null)} onSuccess={() => { setCreateMode(null); setToastMessage("Your story is live.") }} />
      )}
    </Shell.Provider>
  )
}

function GalleryHeader() {
  const { theme, setDrawerOpen, drawerOpen, me } = useShell()
  const router = useRouter()
  const [popover, setPopover] = useState<"" | "notifications" | "profile">("")
  const [query, setQuery] = useState("")
  const { data: unread } = trpc.notification.unreadCount.useQuery(undefined, { enabled: !!me, refetchInterval: 30_000 })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopover("")
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        document.getElementById("gallery-search")?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <header className="header">
      <GalleryPaintDrips theme={theme} />
      <Link href="/" className="logo-link" aria-label="Gallery home"><GalleryLogo theme={theme} /></Link>
      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); router.push(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : "/search") }}>
        <Search size={18} />
        <input id="gallery-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search art, artists, and inspiration..." />
        <kbd>⌘ K</kbd>
      </form>
      <div className="header-actions">
        <span className="live-label"><i /> A space for your imagination</span>
        <Link className="icon-button mobile-search" aria-label="Search" href="/search"><Search size={20} /></Link>
        <button className="icon-button notification" aria-label="Notifications" aria-expanded={popover === "notifications"} onClick={() => setPopover(popover === "notifications" ? "" : "notifications")}>
          <Bell size={21} />{!!unread?.count && <i />}
        </button>
        <button className="avatar-button" aria-label="Profile menu" aria-expanded={popover === "profile"} onClick={() => setPopover(popover === "profile" ? "" : "profile")}>
          <Avatar src={me?.image} name={me?.name ?? "You"} />
        </button>
        <button className="icon-button menu-toggle" aria-label="Open navigation" onClick={() => setDrawerOpen(!drawerOpen)}><Menu size={22} /></button>
      </div>
      {popover === "notifications" && (
        <div className="popover gx-notifications"><NotificationPanel onClose={() => setPopover("")} /></div>
      )}
      {popover === "profile" && me && (
        <div className="popover gx-profile-menu">
          <strong>{me.name}</strong>
          <p>@{me.username}</p>
          <Link href={`/@${me.username}`} onClick={() => setPopover("")}>View profile</Link>
          <Link href="/settings" onClick={() => setPopover("")}>Settings</Link>
          <button onClick={() => signOut({ callbackUrl: "/signin" })}>Sign out</button>
        </div>
      )}
      {popover && <button className="popover-dismiss" aria-label="Close" onClick={() => setPopover("")} />}
    </header>
  )
}

const NAV_ITEMS = [
  { name: "Feed", href: "/", icon: House, isActive: (path: string) => path === "/" },
  { name: "Shop", href: "/shop", icon: ShoppingBag, isActive: (path: string) => path.startsWith("/shop") },
  { name: "Commissions", href: "/commissions", icon: Brush, isActive: (path: string) => path.startsWith("/commissions") },
  { name: "Explore", href: "/search", icon: Compass, isActive: (path: string) => path.startsWith("/search") },
  { name: "Messages", href: "/messages", icon: MessageCircle, isActive: (path: string) => path.startsWith("/messages") },
  { name: "Dashboard", href: "/professional-profile", icon: LayoutDashboard, isActive: (path: string) => path.startsWith("/professional-profile") },
]

/** Left navigation. On phones it becomes a slide-in drawer opened from the header's menu button. */
export function GallerySidebar({ note = "Good things start\nwith a little spark." }: { note?: string }) {
  const { drawerOpen, setDrawerOpen, openCreate, me } = useShell()
  const pathname = usePathname()
  const { data: dmUnread } = trpc.dm.getUnreadCount.useQuery(undefined, { enabled: !!me, refetchInterval: 30_000 })
  const profileHref = me ? `/@${me.username}` : "/"
  const close = () => setDrawerOpen(false)
  const [firstLine, secondLine] = note.split("\n")

  return (
    <>
      <div className={`drawer-backdrop ${drawerOpen ? "show" : ""}`} onClick={close} />
      <aside className={`sidebar ${drawerOpen ? "is-open" : ""}`}>
        <button className="drawer-close icon-button" onClick={close} aria-label="Close navigation"><X /></button>
        <div className="eyebrow nav-caption">YOUR CREATIVE CORNER</div>
        <nav aria-label="Main navigation">
          {NAV_ITEMS.map(({ name, href, icon: Icon, isActive }) => {
            const active = isActive(pathname)
            const badge = name === "Messages" && dmUnread?.count ? (dmUnread.count > 9 ? "9+" : dmUnread.count) : null
            return (
              <Link key={name} href={href} onClick={close} aria-current={active ? "page" : undefined} className={`nav-item ${active ? "active" : ""}`}>
                <Icon size={19} /><span>{name}</span>
                {badge && <small>{badge}</small>}
                {active && <span className="active-dot" />}
              </Link>
            )
          })}
          <Link href={profileHref} onClick={close} className={`nav-item ${me && pathname.startsWith(`/@${me.username}`) ? "active" : ""}`}>
            <User size={19} /><span>Profile</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="make-note">{firstLine}<br />{secondLine} <span>✧</span></div>
          <button className="gradient-button create-post" onClick={() => { close(); openCreate() }}><Plus size={18} /> Create Post</button>
          {me && (
            <Link className="sidebar-user" href={profileHref} onClick={close}>
              <Avatar src={me.image} name={me.name} />
              <div><strong>{me.name}</strong><span>@{me.username}</span></div>
              <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}

function MobileBottomNav() {
  const { openCreate, me } = useShell()
  const pathname = usePathname()
  const profileHref = me ? `/@${me.username}` : "/"
  return (
    <nav className="mobile-bottom" aria-label="Mobile navigation">
      <Link className={pathname === "/" ? "selected" : ""} href="/"><House size={20} />Home</Link>
      <Link className={pathname.startsWith("/search") ? "selected" : ""} href="/search"><Search size={20} />Search</Link>
      <button className="mobile-create" onClick={() => openCreate()} aria-label="Create post"><Plus size={25} /></button>
      <Link className={pathname.startsWith("/messages") ? "selected" : ""} href="/messages"><MessageCircle size={20} />Messages</Link>
      <Link className={me && pathname.startsWith(`/@${me.username}`) ? "selected" : ""} href={profileHref}><User size={20} />Profile</Link>
    </nav>
  )
}

/**
 * Real post creation: pick an image, caption (#hashtags become tags), mark it
 * AI-generated and/or commission work. The image is watermarked with
 * "Gallery | @username", uploaded, saved, and AI-scanned by the server.
 */
function CreatePostDialog({ onClose, onStory }: { onClose: () => void; onStory: () => void }) {
  const { me, toast } = useShell()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [caption, setCaption] = useState("")
  const [image, setImage] = useState("")
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  const [isCommission, setIsCommission] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const createPost = trpc.post.create.useMutation()

  useEffect(() => { dialogRef.current?.showModal() }, [])

  async function onPickFile(file: File | undefined) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError("Please choose an image under 10 MB."); return }
    setError("")
    try { setImage(await resizeImage(file)) } catch { setError("That file couldn't be read as an image.") }
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault()
    if (!image) { setError("Add your artwork to post."); return }
    setBusy(true)
    setError("")
    try {
      let finalImage = image
      try { finalImage = await applyWatermark(image, me?.username ?? "gallery") } catch { /* post without watermark rather than fail */ }
      const imageUrl = await uploadImage(finalImage, "posts")
      const post = await createPost.mutateAsync({ image: imageUrl, description: caption.trim() || undefined, isAiGenerated, isCommission })
      // Show it at the top of the feed right away; it gets ranked normally after a reload.
      addNewPost({
        id: post.id, image: post.image, title: post.title, description: post.description, isAiGenerated: post.isAiGenerated,
        createdAt: post.createdAt, isFollowing: false, isOwnPost: true, likedByMe: false, viewerHasReported: false,
        _count: { likes: 0, comments: 0 },
        user: { id: post.userId, username: me?.username ?? null, name: me?.name ?? null, image: me?.image ?? null },
      })
      toast("Your creation is now in the feed.")
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="create-dialog" onCancel={onClose} onClick={(e) => { if (e.target === dialogRef.current) onClose() }}>
      <div className="dialog-inner">
        <button className="icon-button dialog-close" aria-label="Close dialog" onClick={onClose}><X /></button>
        <form onSubmit={publish}>
          <span className="eyebrow">MAKE YOUR MARK</span>
          <h2>Create something.</h2>
          <div className="modal-modes">
            <button type="button" className="selected">Image</button>
            <button type="button" onClick={onStory}>Story</button>
            <button type="button" className={isAiGenerated ? "selected" : ""} aria-pressed={isAiGenerated} onClick={() => setIsAiGenerated(!isAiGenerated)}>AI-generated</button>
            <button type="button" className={isCommission ? "selected" : ""} aria-pressed={isCommission} onClick={() => setIsCommission(!isCommission)}>Commission work</button>
          </div>
          <label className="sr-only" htmlFor="post-text">Post caption</label>
          <textarea id="post-text" autoFocus maxLength={2200} placeholder="What are you creating today? Add #tags to be found." value={caption} onChange={(e) => setCaption(e.target.value)} />
          <label className="upload">
            <ImagePlus size={24} />{image ? "Artwork attached — click to replace" : "Add your artwork"}
            <input type="file" accept="image/*" onChange={(e) => onPickFile(e.target.files?.[0])} />
          </label>
          {image && <img className="upload-preview" src={image} alt="Your artwork preview" />}
          {error && <p className="mode-hint gx-error">{error}</p>}
          <button className="gradient-button publish" disabled={!image || busy}>{busy ? "Publishing…" : <>Publish post <Sparkles size={16} /></>}</button>
        </form>
      </div>
    </dialog>
  )
}
