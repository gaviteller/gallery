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

/**
 * Which AI models do the work (OpenRouter model ids, set in the environment):
 *   MODERATION_MODEL  every scan: describe, then judge (default below until a stronger one is chosen)
 *   REVIEW_MODEL      optional second opinion, run only on items the first model flags
 */
const AI_MODEL = process.env.MODERATION_MODEL || "meta-llama/llama-4-scout"
const REVIEW_MODEL = process.env.REVIEW_MODEL || ""
const AI_REQUEST_TIMEOUT_MS = 60_000
const SEVERITIES = ["ZERO", "URGENT", "SEVERE", "REVIEW", "CHECK"] as const
type Severity = (typeof SEVERITIES)[number]

/** One broken rule, with its own reason. A flag lists every one that applies. */
export interface Violation {
  rule: string
  /** The rulebook line being applied, quoted. */
  quote: string
  /** Which part of the item matches (e.g. "the words written on the sign", "the caption"). */
  part: string
  why: string
}

/** The AI's judgement of one item, as recorded in AIScanLog.scores. */
export interface Judgement {
  flagged: boolean
  violations: Violation[]
  /** Rule codes of the violations (kept for admin screens and tracking). */
  rules: string[]
  severity: Severity | "NONE"
  /** Step 1: plain description of what's in the image and text, before any judging. */
  saw: string
  /** All the reasons joined, for older admin screens. */
  why: string
  confidence: "low" | "medium" | "high"
  aiArtSuspected: boolean
  aiArtWhy: string
  rulebookVersion: number
  model: string
  /** Set when the second-opinion model disagreed. */
  secondOpinion?: string
}

// ── The rulebook and the team's lessons ──────────────────────────────────
let cachedPolicy: { text: string; version: number; at: number } | null = null
/** Newest rulebook, cached for a minute so a busy site doesn't read it on every scan. */
export async function getRulebook(prisma: PrismaClient): Promise<{ text: string; version: number } | null> {
  if (cachedPolicy && Date.now() - cachedPolicy.at < 60_000) return cachedPolicy
  const latest = await prisma.moderationPolicy.findFirst({ orderBy: { version: "desc" }, select: { text: true, version: true } })
  if (!latest) return null
  cachedPolicy = { ...latest, at: Date.now() }
  return latest
}

/**
 * Only the rules go to the AI: everything before the first "## " heading (status lines, notes
 * to the owner) is dropped, along with the review markers.
 */
function rulesOnly(text: string): string {
  const first = text.indexOf("\n## ")
  return (first >= 0 ? text.slice(first + 1) : text)
    .replace(/✅ \*\*DECIDED[^*]*\*\*:?\s*/g, "")
    .replace(/☑ \*\*PROPOSED[^*]*\*\*:?\s*/g, "")
    .replace(/\(pending Q\d+\)/g, "")
}

/** Every rule code the rulebook defines, e.g. HATE-3. Codes the AI invents are thrown away. */
function ruleCodes(text: string): Set<string> {
  return new Set([...text.matchAll(/`([A-Z]+-\d+)`/g)].map((m) => m[1]))
}

/**
 * What the team has taught it (AiLesson rows: from reasons given when answering flags, and
 * lessons saved in the admin chat). Newest first; only the kind that applies (IMAGE / TEXT / ALL).
 */
async function getLessons(prisma: PrismaClient, kind: "IMAGE" | "TEXT"): Promise<string> {
  const lessons = await prisma.aiLesson.findMany({
    where: { active: true, appliesTo: { in: [kind, "ALL"] } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { text: true },
  }).catch(() => [])
  return lessons.map((l) => `- ${l.text.replace(/\s+/g, " ").slice(0, 400)}`).join("\n")
}

// ── Asking the AI ────────────────────────────────────────────────────────
type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }

async function askOpenRouter(content: Part[], model = AI_MODEL, maxTokens = 900): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    // temperature 0 → the same item gets the same answer every time
    body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages: [{ role: "user", content }] }),
  })
  if (response.status === 402) throw new Error("OpenRouter 402: the AI account is out of credit (add credit at openrouter.ai)")
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 200)}`)
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

/** Takes the FIRST complete {...} object in the reply (models sometimes add text or a second object after it). */
function firstJsonObject(reply: string): Record<string, unknown> {
  const start = reply.indexOf("{")
  if (start < 0) throw new Error(`AI reply had no JSON: ${reply.slice(0, 160)}`)
  let depth = 0, end = -1, inString = false
  for (let i = start; i < reply.length; i++) {
    const ch = reply[i]
    if (inString) { if (ch === "\\") i++; else if (ch === '"') inString = false; continue }
    if (ch === '"') inString = true
    else if (ch === "{") depth++
    else if (ch === "}" && --depth === 0) { end = i; break }
  }
  if (end < 0) throw new Error(`AI reply had unfinished JSON: ${reply.slice(0, 160)}`)
  return JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>
}

/** Checks every field of the judge's answer so a sloppy reply can't break anything. */
function readJudgement(raw: Record<string, unknown>, known: Set<string>): Omit<Judgement, "saw" | "rulebookVersion" | "model"> {
  const violations: Violation[] = (Array.isArray(raw.violations) ? raw.violations : [])
    .map((v) => v as Record<string, unknown>)
    .map((v) => ({ rule: String(v.rule ?? "").trim().toUpperCase(), quote: String(v.quote ?? "").slice(0, 300), part: String(v.part ?? "").slice(0, 200), why: String(v.why ?? "").slice(0, 500) }))
    // Only real rulebook codes, and only when the AI actually explained it.
    .filter((v) => known.has(v.rule) && v.why.trim().length > 0)
  const sev = String(raw.severity ?? "").toUpperCase()
  // No real violation → not flagged, whatever severity it typed. A violation without a valid severity → REVIEW.
  const severity: Severity | "NONE" = violations.length === 0 ? "NONE" : (SEVERITIES as readonly string[]).includes(sev) ? (sev as Severity) : "REVIEW"
  const confidence = ["low", "medium", "high"].includes(String(raw.confidence)) ? (raw.confidence as Judgement["confidence"]) : "low"
  return {
    flagged: severity !== "NONE",
    violations,
    rules: [...new Set(violations.map((v) => v.rule))],
    severity,
    why: violations.map((v) => `${v.rule}: ${v.why}`).join(" | ") || String(raw.allowedBecause ?? "").slice(0, 400),
    confidence,
    aiArtSuspected: raw.aiArtSuspected === true,
    aiArtWhy: String(raw.aiArtWhy ?? "").slice(0, 400),
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

/** STEP 1 — look: a factual description of the image and text, with no rules involved. */
async function describe(subject: Subject, image: string | null, fields: [string, unknown][], model: string): Promise<string> {
  const content: Part[] = [{
    type: "text",
    text: `Describe this ${subject.label} factually and precisely. Do NOT judge it or mention any rules.
${image ? `For the image, cover: who is in it (apparent age: child / teen / adult), what they wear and how much is covered, what they are doing, objects (weapons, drugs, money, symbols), any blood or injuries, ANY words or symbols written in the image (quote them exactly), the setting, and the art style (photo / painting / drawing / 3D / pixel art) with any signs of AI generation (warped hands or text, inconsistent details).` : ""}
${fields.length ? `Then restate what the text says and who it is aimed at:\n${fields.map(([k, v]) => `${k}: """${String(v).slice(0, 2000)}"""`).join("\n")}` : ""}
Plain sentences, at most 150 words.`,
  }]
  if (image) content.unshift({ type: "image_url", image_url: { url: image } })
  return (await askOpenRouter(content, model, 400)).slice(0, 1500)
}

/** STEP 2 — judge: compare the description (and the original image/text) to the rulebook and the team's lessons. */
async function judge(subject: Subject, image: string | null, fields: [string, unknown][], description: string, rules: string, lessons: string, known: Set<string>, model: string) {
  const content: Part[] = [{
    type: "text",
    text: `You are Gallery's content moderation AI. Gallery is an art social platform. You never remove anything; you report rule breaks to the moderation team.

How to judge:
- Use ONLY the rulebook below. If something is not clearly against a specific rule, it is allowed.
- Baseline: if Instagram would normally allow it, it is allowed (unless the rulebook is deliberately stricter, e.g. no nudity).
- Fiction gets room: drawn violence, horror, villains, crime stories and drug scenes are allowed as storytelling unless a rule says otherwise.
- Judge the item AS A WHOLE (image + all its text). Do not flag random or made-up usernames, names, or test text just because they are unusual.
- List EVERY rule the item breaks, each with its own reason. For each one, quote the exact rulebook line you are applying and say which part of the item matches it. If you cannot quote a rule line that clearly matches, do not list it.
- The TEAM'S LESSONS override your own instincts: they are decisions the moderators made about similar content.
- Define the key term before applying it. A SLUR is an insulting word for a group of people defined by race, ethnicity, religion, gender, sexuality, disability or similar, used to demean them. Ordinary names, animals ("rat"), fruit, jokes like "joemama", random letters or numbers, and "god" in a greeting are NOT slurs. Only flag a slur if you can name the exact word AND the group it targets.
- HARASSMENT and BULLYING need a target (a person or group) and an insult or threat aimed at them. SELF-HARM rules are only about hurting oneself: insults like "you're pathetic" are bullying, not self-harm.
- NUDITY means visible nipples, genitals or bare buttocks. Covered chests, armour, swimwear and revealing outfits are not nudity.
- For AI art, a polished or detailed style is NOT a sign of AI by itself; look for concrete artefacts (warped hands or fingers, garbled text, melted or inconsistent details).

===== RULEBOOK =====
${rules}
===== END OF RULEBOOK =====

===== TEAM'S LESSONS (newest first) =====
${lessons || "(none yet)"}
===== END OF LESSONS =====

ITEM: a ${subject.label}. Where it appears: ${subject.where}.
WHAT IS IN IT (careful description made before judging):
${description}
${fields.length ? `ORIGINAL TEXT:\n${fields.map(([k, v]) => `${k}: """${String(v).slice(0, 2000)}"""`).join("\n")}` : ""}
${image ? "The original image is attached too; check the description against it." : subject.image ? "(The image could not be loaded.)" : ""}
${subject.checkAiArt ? `AI ART: the artist ${subject.labelledAi ? "HAS labelled this as AI, so set aiArtSuspected=false" : "has NOT labelled it as AI. Set aiArtSuspected=true only if you see concrete signs of AI generation, and say which"}.` : "Set aiArtSuspected=false."}

Reply with ONLY one JSON object:
{"violations":[{"rule":"CODE-N","quote":"exact rulebook line","part":"which part of the item","why":"why that part breaks that rule"}],"severity":"NONE|CHECK|REVIEW|SEVERE|URGENT|ZERO","confidence":"low|medium|high","allowedBecause":"if nothing is broken, one sentence on why it's allowed","aiArtSuspected":false,"aiArtWhy":""}
Use "violations":[] and "severity":"NONE" when nothing is broken. Severity is the most serious violation's level (ZERO/URGENT/SEVERE/REVIEW/CHECK as defined in the rulebook).`,
  }]
  if (image) content.unshift({ type: "image_url", image_url: { url: image } })
  return readJudgement(firstJsonObject(await askOpenRouter(content, model, 1200)), known)
}

/** Asks the AI to judge one item against the rulebook: look first, then judge, then (optionally) a second opinion. */
export async function judgeContent(prisma: PrismaClient, subject: Subject): Promise<Judgement> {
  const rulebook = await getRulebook(prisma)
  if (!rulebook) throw new Error("No rulebook saved yet (admin → Moderation → Rulebook)")
  const rules = rulesOnly(rulebook.text)
  const known = ruleCodes(rulebook.text)
  const fields = Object.entries(subject.text).filter(([, v]) => v && String(v).trim())
  const image = subject.image ? await imageForAi(subject.image) : null
  const lessons = await getLessons(prisma, image ? "IMAGE" : "TEXT")

  const description = await describe(subject, image, fields, AI_MODEL)
  let result = await judge(subject, image, fields, description, rules, lessons, known, AI_MODEL)
  let secondOpinion: string | undefined

  // Second opinion: a stronger model re-checks only what the first one flagged.
  if (result.flagged && REVIEW_MODEL) {
    const second = await judge(subject, image, fields, description, rules, lessons, known, REVIEW_MODEL)
    if (!second.flagged) {
      secondOpinion = `${REVIEW_MODEL} found nothing against the rules: ${second.why}`
      result = { ...result, severity: "CHECK", confidence: "low" } // models disagree → low-priority check
    } else {
      result = second // the stronger model's reasons replace the first model's
    }
  }

  // Art the artist already labelled as AI is never "unlabelled AI art", and only posts/listings are checked.
  if (!subject.checkAiArt || subject.labelledAi) result.aiArtSuspected = false
  return { ...result, saw: description, rulebookVersion: rulebook.version, model: secondOpinion || !REVIEW_MODEL || !result.flagged ? AI_MODEL : REVIEW_MODEL, secondOpinion }
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

/**
 * True when the artist's own words label the work as AI: #ai / #aiart hashtags, "AI art",
 * "AI generated", "made with Midjourney" and similar. Counts the same as the post's AI switch.
 */
export function mentionsAi(text: string): boolean {
  return /(^|[^a-z0-9])#?ai(art|artwork|generated|gen|assisted|illustration)?([^a-z0-9]|$)/i.test(text)
    || /\b(ai[- ]?(generated|assisted|made|art)|made (with|using) ai|midjourney|stable ?diffusion|dall[- ]?e|niji(journey)?|novelai|leonardo\.?ai)\b/i.test(text)
}

// ── What gets scanned ────────────────────────────────────────────────────
/** A post (or delivered commission piece). `notify` = send the AI-art notice (new uploads, not sweeps). */
export async function scanPost(prisma: PrismaClient, postId: string, _userId?: string, imageOverride?: string, notify = true): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { image: true, title: true, description: true, isAiGenerated: true, isCommission: true, userId: true, hashtags: { select: { tag: true } } },
  })
  if (!post) return
  const text = [post.title, post.description, ...post.hashtags.map((h) => `#${h.tag}`)].join(" ")
  const j = await scan(prisma, "POST", postId, {
    label: post.isCommission ? "commission artwork post" : "post",
    where: "public feed, profiles and Explore",
    text: { title: post.title, caption: post.description, hashtags: post.hashtags.map((h) => `#${h.tag}`).join(" ") },
    image: imageOverride ?? post.image,
    checkAiArt: true,
    labelledAi: post.isAiGenerated || mentionsAi(text),
  })
  if (j) await prisma.post.update({ where: { id: postId }, data: { aiVerdict: j.flagged ? j.severity : "SAFE", aiScores: j as object } }).catch(() => {})
  if (j?.aiArtSuspected && notify) await sendAiArtNotice(prisma, post.userId, "post")
}

/** A shop listing. */
export async function scanShopItem(prisma: PrismaClient, itemId: string, _userId?: string, imageOverride?: string, notify = true): Promise<void> {
  const item = await prisma.shopItem.findUnique({ where: { id: itemId }, select: { image: true, title: true, description: true, tags: true, userId: true } })
  if (!item) return
  const itemText = [item.title, item.description, ...item.tags].join(" ")
  const j = await scan(prisma, "SHOP_ITEM", itemId, {
    label: "shop listing (artwork for sale)",
    where: "public shop; its thumbnail appears across the site",
    text: { title: item.title, description: item.description, tags: item.tags.join(", ") },
    image: imageOverride ?? item.image,
    checkAiArt: true,
    labelledAi: mentionsAi(itemText),
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
