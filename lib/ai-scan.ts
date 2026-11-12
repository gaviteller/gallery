/**
 * AI CONTENT MODERATION — RULEBOOK-DRIVEN, INFORM-ONLY (teaching phase).
 *
 * The AI moderates from Gallery's written rulebook (the newest ModerationPolicy row, edited in
 * the admin panel → Moderation → Rulebook). Nothing about WHAT is allowed is hard-coded here:
 * change the rulebook and moderation changes. This file only says HOW to ask the AI and what
 * to record.
 *
 * The AI never blocks, hides, removes, strikes or bans anything. For every item it judges, it
 * writes an AIScanLog row: rule codes broken, severity, what it saw, why, confidence. Flagged
 * items show up in the admin's AI flags queue; the team decides and answers "AI right / wrong"
 * with a reason, which is how it gets taught (step 2).
 *
 * Judged as a whole (image + every bit of text that goes with it):
 *   scanPost              posts (image, title, caption, hashtags) and delivered commission pieces
 *   scanShopItem          shop listings (image, title, description, tags)
 *   scanStory             stories (image)
 *   scanAvatar            profile photos and banners (strictest: they appear everywhere)
 *   scanProfileText       usernames, display names and bios (strictest)
 *   scanComment           comments
 *   scanChatMessage       direct messages and commission chat text
 *   scanCommissionRequest commission request descriptions
 * Commission reference photos and file attachments are NOT scanned (private — report-only).
 *
 * Suspected unlabelled AI art (rulebook AIART-1): tracked with its own log row
 * (action AI_ART_SUSPECTED) and, for new uploads, the artist gets an automated notice asking
 * them to label it or send evidence. It is never hidden or removed.
 *
 * AIScanLog fields used: scores = the AI's full judgement (+ "reason" = its why, for older admin
 * screens); verdict = severity (ZERO/URGENT/SEVERE/REVIEW/CHECK) or CLEAN; action = FLAGGED_<severity>,
 * AI_ART_SUSPECTED, NONE, or SCAN_ERROR: …  Team feedback: overriddenAt/By, overridden (= AI wrong), reviewNote.
 *
 * If OPENROUTER_API_KEY is missing, nothing is scanned.
 */
import { PrismaClient } from "@prisma/client"

const AI_MODEL = "meta-llama/llama-4-scout"
const AI_REQUEST_TIMEOUT_MS = 45_000
const SEVERITIES = ["ZERO", "URGENT", "SEVERE", "REVIEW", "CHECK"] as const
type Severity = (typeof SEVERITIES)[number]

/** The AI's judgement of one item, as recorded in AIScanLog.scores. */
export interface Judgement {
  flagged: boolean
  rules: string[]
  severity: Severity | "NONE"
  saw: string
  why: string
  confidence: "low" | "medium" | "high"
  aiArtSuspected: boolean
  aiArtWhy: string
  rulebookVersion: number
}

// ── The rulebook ─────────────────────────────────────────────────────────
let cachedPolicy: { text: string; version: number; at: number } | null = null
/** Newest rulebook, cached for a minute so a busy site doesn't read it on every scan. */
export async function getRulebook(prisma: PrismaClient): Promise<{ text: string; version: number } | null> {
  if (cachedPolicy && Date.now() - cachedPolicy.at < 60_000) return cachedPolicy
  const latest = await prisma.moderationPolicy.findFirst({ orderBy: { version: "desc" }, select: { text: true, version: true } })
  if (!latest) return null
  cachedPolicy = { ...latest, at: Date.now() }
  return latest
}

// ── Asking the AI ────────────────────────────────────────────────────────
type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }

async function askOpenRouter(content: Part[]): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    // temperature 0 → the same item gets the same answer every time
    body: JSON.stringify({ model: AI_MODEL, temperature: 0, max_tokens: 700, messages: [{ role: "user", content }] }),
  })
  if (!response.ok) throw new Error(`OpenRouter ${response.status}`)
  const body = await response.json()
  return (body.choices?.[0]?.message?.content ?? "").trim()
}

/** The AI service can only see images it can download: site-relative paths are fetched and inlined. */
async function imageForAi(src: string): Promise<string | null> {
  if (src.startsWith("data:image/")) return src
  try {
    const url = src.startsWith("/") ? `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}${src}` : src
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !type.startsWith("image/")) return null
    return `data:${type.split(";")[0]};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`
  } catch {
    return null
  }
}

/** Pulls the first {...} block out of the reply and checks every field, so a sloppy answer can't break anything. */
function readJudgement(reply: string, version: number): Judgement {
  const start = reply.indexOf("{")
  const end = reply.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error(`AI reply had no JSON: ${reply.slice(0, 160)}`)
  const raw = JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>
  const sev = String(raw.severity ?? "").toUpperCase()
  const severity = (SEVERITIES as readonly string[]).includes(sev) ? (sev as Severity) : "NONE"
  const rules = Array.isArray(raw.rules) ? raw.rules.map((r) => String(r).trim().toUpperCase()).filter((r) => /^[A-Z]+-\d+$/.test(r)) : []
  const confidence = ["low", "medium", "high"].includes(String(raw.confidence)) ? (raw.confidence as Judgement["confidence"]) : "low"
  // Our own consistency check: a flag needs a severity, and a severity means it's flagged.
  const flagged = severity !== "NONE"
  return {
    flagged,
    rules: flagged ? rules : [],
    severity,
    saw: String(raw.saw ?? "").slice(0, 600),
    why: String(raw.why ?? "").slice(0, 900),
    confidence,
    aiArtSuspected: raw.aiArtSuspected === true,
    aiArtWhy: String(raw.aiArtWhy ?? "").slice(0, 400),
    rulebookVersion: version,
  }
}

type Subject = {
  /** e.g. "post", "profile photo" — told to the AI. */
  label: string
  /** Where it appears, e.g. "public feed" or "private message between two users". */
  where: string
  /** Labelled text that goes with the item (title, caption, message…). Empty values are skipped. */
  text: Record<string, string | null | undefined>
  image?: string | null
  /** Only posts and shop listings are checked for unlabelled AI art. */
  checkAiArt?: boolean
  /** True when the artist already labelled it as AI. */
  labelledAi?: boolean
}

/** Asks the AI to judge one item against the rulebook. */
export async function judgeContent(prisma: PrismaClient, subject: Subject): Promise<Judgement> {
  const rulebook = await getRulebook(prisma)
  if (!rulebook) throw new Error("No rulebook saved yet (admin → Moderation → Rulebook)")
  const fields = Object.entries(subject.text).filter(([, v]) => v && String(v).trim())
  const image = subject.image ? await imageForAi(subject.image) : null

  const instructions = `You are Gallery's content moderation AI. Gallery is an art social platform.
You moderate ONLY by the rulebook below. Judge the item AS A WHOLE: the image and all of its text together.
You never remove anything — you only report. While you are learning, when you are genuinely unsure, flag it as CHECK rather than letting it pass. But do NOT flag things the rulebook explicitly allows (its baseline: if Instagram would normally allow it, it's allowed, unless the rulebook is deliberately stricter).

===== RULEBOOK (version ${rulebook.version}) =====
${rulebook.text}
===== END OF RULEBOOK =====

ITEM TO JUDGE: a ${subject.label}. Where it appears: ${subject.where}.
${fields.length ? fields.map(([k, v]) => `${k}: """${String(v).slice(0, 2000)}"""`).join("\n") : "(no text)"}
${image ? "The image is attached." : subject.image ? "(The image could not be loaded — judge the text only and say so.)" : "(no image)"}
${subject.checkAiArt ? `Also judge whether the artwork looks AI-generated. The artist ${subject.labelledAi ? "HAS labelled it as AI" : "has NOT labelled it as AI"}. Only set aiArtSuspected=true if it is NOT labelled and you see real signs of AI generation.` : "Set aiArtSuspected=false."}

Reply with ONLY one JSON object, no markdown:
{"severity":"NONE|CHECK|REVIEW|SEVERE|URGENT|ZERO","rules":["RULE-CODES from the rulebook that apply, e.g. HATE-3"],"saw":"plain description of what you saw and read","why":"which rule matches which part of the item, or why it is allowed","confidence":"low|medium|high","aiArtSuspected":false,"aiArtWhy":""}
Use severity NONE (and rules []) when nothing in the rulebook is broken.`

  const content: Part[] = [{ type: "text", text: instructions }]
  if (image) content.unshift({ type: "image_url", image_url: { url: image } })
  return readJudgement(await askOpenRouter(content), rulebook.version)
}

// ── Recording ────────────────────────────────────────────────────────────
async function record(prisma: PrismaClient, contentType: string, contentId: string, j: Judgement, extra: Record<string, unknown> = {}) {
  await prisma.aIScanLog.create({
    data: {
      contentType,
      contentId,
      scores: { ...j, reason: j.why, ...extra } as object,
      verdict: j.flagged ? j.severity : "CLEAN",
      action: j.flagged ? `FLAGGED_${j.severity}` : "NONE",
    },
  })
  if (j.aiArtSuspected) {
    await prisma.aIScanLog.create({
      data: { contentType, contentId, scores: { ...j, reason: j.aiArtWhy || "Possible unlabelled AI art", ...extra } as object, verdict: "CHECK", action: "AI_ART_SUSPECTED" },
    })
  }
}

async function logScanError(prisma: PrismaClient, contentType: string, contentId: string, err: unknown) {
  console.error(`[ai-scan] ${contentType} scan failed:`, err)
  try {
    await prisma.aIScanLog.create({ data: { contentType, contentId, scores: {}, verdict: "ERROR", action: `SCAN_ERROR: ${String(err).slice(0, 300)}` } })
  } catch {}
}

/** Runs one scan; errors are logged, never thrown (a scan must never break posting). Returns the judgement or null. */
async function scan(prisma: PrismaClient, contentType: string, contentId: string, subject: Subject, extra?: Record<string, unknown>) {
  if (!process.env.OPENROUTER_API_KEY) return null
  try {
    const j = await judgeContent(prisma, subject)
    await record(prisma, contentType, contentId, j, extra)
    return j
  } catch (err) {
    await logScanError(prisma, contentType, contentId, err)
    return null
  }
}

/** Automated notice for suspected unlabelled AI art (rulebook AIART-1). Only for new uploads. */
async function sendAiArtNotice(prisma: PrismaClient, userId: string, what: string) {
  await prisma.notification.create({
    data: {
      userId, fromUserId: null, type: "site_notice",
      message: `We've detected possible AI use in your ${what}. Please label it as AI-assisted, or send us evidence that it isn't (for example work-in-progress shots or the layered file).`,
    },
  }).catch(() => {})
}

// ── What gets scanned ────────────────────────────────────────────────────
/** A post (or delivered commission piece). `notify` = send the AI-art notice (new uploads, not sweeps). */
export async function scanPost(prisma: PrismaClient, postId: string, _userId?: string, imageOverride?: string, notify = true): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { image: true, title: true, description: true, isAiGenerated: true, isCommission: true, userId: true, hashtags: { select: { tag: true } } },
  })
  if (!post) return
  const j = await scan(prisma, "POST", postId, {
    label: post.isCommission ? "commission artwork post" : "post",
    where: "public feed, profiles and Explore",
    text: { title: post.title, caption: post.description, hashtags: post.hashtags.map((h) => `#${h.tag}`).join(" ") },
    image: imageOverride ?? post.image,
    checkAiArt: true,
    labelledAi: post.isAiGenerated,
  })
  if (j) await prisma.post.update({ where: { id: postId }, data: { aiVerdict: j.flagged ? j.severity : "SAFE", aiScores: j as object } }).catch(() => {})
  if (j?.aiArtSuspected && notify) await sendAiArtNotice(prisma, post.userId, "post")
}

/** A shop listing. */
export async function scanShopItem(prisma: PrismaClient, itemId: string, _userId?: string, imageOverride?: string, notify = true): Promise<void> {
  const item = await prisma.shopItem.findUnique({ where: { id: itemId }, select: { image: true, title: true, description: true, tags: true, userId: true } })
  if (!item) return
  const j = await scan(prisma, "SHOP_ITEM", itemId, {
    label: "shop listing (artwork for sale)",
    where: "public shop; its thumbnail appears across the site",
    text: { title: item.title, description: item.description, tags: item.tags.join(", ") },
    image: imageOverride ?? item.image,
    checkAiArt: true,
  })
  if (j) await prisma.shopItem.update({ where: { id: itemId }, data: { aiVerdict: j.flagged ? j.severity : "SAFE", aiScores: j as object } }).catch(() => {})
  if (j?.aiArtSuspected && notify) await sendAiArtNotice(prisma, item.userId, "shop listing")
}

/** A story (disappears after 24 hours). */
export async function scanStory(prisma: PrismaClient, storyId: string): Promise<void> {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { image: true } })
  if (!story) return
  await scan(prisma, "STORY", storyId, { label: "story", where: "shown to followers at the top of the feed for 24 hours", text: {}, image: story.image })
}

/** A profile photo or banner — strictest standard, it appears everywhere. */
export async function scanAvatar(prisma: PrismaClient, userId: string, field: "image" | "bannerImage", imageDataUrl: string): Promise<void> {
  await scan(prisma, "AVATAR", userId, {
    label: field === "image" ? "profile photo" : "profile banner",
    where: "next to everything this user posts, everywhere on the site (strictest standard)",
    text: {},
    image: imageDataUrl,
  }, { image: imageDataUrl, field })
}

/** Username, display name and bio — strictest standard. */
export async function scanProfileText(prisma: PrismaClient, userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true, bio: true, websiteUrl: true } })
  if (!u || (!u.username && !u.name && !u.bio)) return
  await scan(prisma, "PROFILE", userId, {
    label: "user profile (username, display name and bio)",
    where: "shown everywhere this user appears (strictest standard)",
    text: { username: u.username, "display name": u.name, bio: u.bio, website: u.websiteUrl },
  })
}

/** A comment on a post. */
export async function scanComment(prisma: PrismaClient, commentId: string): Promise<void> {
  const c = await prisma.comment.findUnique({ where: { id: commentId }, select: { text: true, post: { select: { title: true, description: true } } } })
  if (!c) return
  await scan(prisma, "COMMENT", commentId, {
    label: "public comment",
    where: "under a post, visible to everyone",
    text: { comment: c.text, "post it was left on": c.post.title || c.post.description },
  })
}

/** A direct message or commission chat message. */
export async function scanChatMessage(prisma: PrismaClient, kind: "DM" | "COMMISSION", messageId: string): Promise<void> {
  const m = kind === "DM"
    ? await prisma.directMessage.findUnique({ where: { id: messageId }, select: { text: true } })
    : await prisma.professionalMessage.findUnique({ where: { id: messageId }, select: { text: true } })
  if (!m?.text?.trim()) return
  await scan(prisma, kind === "DM" ? "DM_MESSAGE" : "COMMISSION_MESSAGE", messageId, {
    label: kind === "DM" ? "private direct message" : "message in a commission chat between buyer and artist",
    where: "private conversation between two users (same rules, but allow normal friendly conversation)",
    text: { message: m.text },
  })
}

/** The description a buyer writes when requesting a commission. */
export async function scanCommissionRequest(prisma: PrismaClient, commissionId: string): Promise<void> {
  const c = await prisma.commission.findUnique({ where: { id: commissionId }, select: { description: true } })
  if (!c?.description?.trim()) return
  await scan(prisma, "COMMISSION_REQUEST", commissionId, {
    label: "commission request sent from a buyer to an artist",
    where: "private, seen by the artist",
    text: { request: c.description },
  })
}
