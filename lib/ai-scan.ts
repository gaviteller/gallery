import { PrismaClient, StrikeLevel, StrikeViolation } from "@prisma/client"

const PROMPT = `You are the image moderation AI for Gallery, an art platform.

IMPORTANT: These rules apply equally to ALL art styles and mediums — anime, illustration, digital art, photography, realistic, abstract, manga, 3D render. Do not apply different standards based on art style or medium.

=== MINOR DETECTION ===
Judge age by overall body proportions and facial features, NOT height alone. A short character with adult body proportions and adult facial features is NOT a minor. Only flag as minor if the character has BOTH clearly childlike body proportions (no chest/hip development, small frame) AND clearly childlike facial features (round face, large eyes relative to face, small nose, no defined jaw). If a minor is detected AND any category scores 5 or above, return: {"clothing":10,"pose":10,"violence":10,"selfHarm":10,"combined":100,"verdict":"EXPLICIT","reason":"Minor detected in inappropriate content — zero tolerance violation."}

=== SCORING CATEGORIES ===
Rate each 1-10. Judge clothing/pose by what is ACTUALLY VISIBLE, not just what is technically worn. Hair or natural coverage fully concealing the chest = 7 (not 8). Same outfit can score differently depending on angle and what the pose reveals.

CLOTHING/EXPOSURE (weight 30%):
1 = Fully clothed, modest
2 = Fitted/form-fitting but fully covered
3 = Slightly revealing — midriff, low neckline, short skirt, shirtless male
4 = Noticeably revealing — visible cleavage, crop tops, short shorts
5 = Swimwear, lingerie, underwear — technically covered
6 = Very minimal — barely-there, see-through fabric, or hair/natural coverage fully concealing chest
7 = Topless female with hair/arm/object providing clear full coverage OR partial nudity one area just exposed
8 = Mostly exposed — topless female with only minimal coverage (arm barely covering, etc.), only genitals covered
9 = Genitals technically covered but nothing left to imagination (body paint, tape, pasties)
10 = Any nudity with genitals/nipples exposed OR any sexual act — auto-remove

POSE/INTENT (weight 10%):
1 = Neutral everyday pose
2 = Expressive/dynamic — action, dance, athletics, emotional
3 = Confident/alluring — slight lean, hand on hip, artistic
4 = Noticeably suggestive — arched back, holding intimate items, bedroom eyes
5 = Clearly suggestive — spread legs while clothed, hands near intimate areas, deliberate undressing
6 = Overtly sexual — provocative grinding, straddling, deliberately emphasising body parts
7 = Strong sexual implication — actively undressing, pose strongly implies sexual activity
8 = Simulating a sexual act — clearly miming one
9 = Near-explicit — sexual act implied with almost no ambiguity
10 = Explicit sexual act — auto-remove

VIOLENCE/GORE (weight 30%):
1 = No violence
2 = Implied or off-screen — no visible harm
3 = Cartoon/stylised violence — no blood, clear fiction
4 = Mild blood — small wounds in clear fictional context
5 = Moderate gore — visible injuries and blood, clearly narrative/artistic
6 = Strong gore — significant wounds, visceral detail, still has artistic framing
7 = Graphic gore — heavy blood/wounds, artistic context is thin
8 = Severe gore — organs, dismemberment, minimal artistic justification
9 = Extreme gore — purely disturbing, no narrative purpose visible
10 = Gratuitous gore with zero artistic context — shock value only, auto-remove

SELF-HARM (weight 30%):
1 = No self-harm content
2 = Emotional or sad themes — no visible harm
3 = Dark or melancholic aesthetic (dark colours, sad expression, atmospheric) — no wounds or methods
4 = Implied self-harm — bandages or scars but not graphic
5 = Visible old scars or healed wounds in artistic context
6 = Fresh wounds visible but not graphic, or scene strongly associated with self-harm (e.g. graphic depiction of drowning attempt)
7 = Graphic self-inflicted wounds, detailed
8 = Active self-harm being depicted
9 = Glorifying or instructional self-harm imagery
10 = Explicit graphic self-harm with no artistic framing — auto-remove

=== COMBINED SCORE ===
combined = floor((clothing × 30 + pose × 10 + violence × 30 + selfHarm × 30) / 10)

=== VERDICT ===
SAFE = combined 1-49
SUGGESTIVE = combined 50-69
EXPLICIT = combined 70-100

Override rules (apply before calculating verdict):
- Any single category = 10 → combined = 100, verdict = EXPLICIT
- Any single category = 9 → combined = 90, verdict = EXPLICIT
- Clothing OR violence OR selfHarm is 7-8 → verdict = EXPLICIT minimum (combined floor 70)
- Clothing ≥ 6 AND pose ≥ 7 → verdict = SUGGESTIVE minimum (combined floor 50)

Respond with ONLY a JSON object — no markdown, no code blocks:
{"clothing":1,"pose":1,"violence":1,"selfHarm":1,"combined":10,"verdict":"SAFE","reason":"one sentence referencing the specific rule or scale level"}`

interface ScanScores {
  clothing: number
  pose: number
  violence: number
  selfHarm: number
  combined: number
  verdict: "SAFE" | "SUGGESTIVE" | "EXPLICIT"
  reason: string
}

async function callOpenRouter(imageDataUrl: string): Promise<ScanScores> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  let res: Response
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.2-11b-vision-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
  const data = await res.json()
  const text: string = (data.choices?.[0]?.message?.content ?? "").trim()
  const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()

  // Primary parse
  try {
    return JSON.parse(clean) as ScanScores
  } catch {
    // Fallback: extract fields individually when model truncates the JSON
    const num = (key: string, fallback: number) => {
      const m = clean.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`))
      return m ? parseInt(m[1], 10) : fallback
    }
    const clothing = num("clothing", 1)
    const pose = num("pose", 1)
    const violence = num("violence", 1)
    const selfHarm = num("selfHarm", 1)
    const combined = num("combined", Math.floor((clothing * 30 + pose * 10 + violence * 30 + selfHarm * 30) / 10))
    const verdictMatch = clean.match(/"verdict"\s*:\s*"(SAFE|SUGGESTIVE|EXPLICIT)"/)
    const verdict = (verdictMatch?.[1] ?? (combined >= 70 ? "EXPLICIT" : combined >= 50 ? "SUGGESTIVE" : "SAFE")) as ScanScores["verdict"]
    const reasonMatch = clean.match(/"reason"\s*:\s*"([^"]*)"/)
    const reason = reasonMatch?.[1] ?? "AI response was truncated — manual review recommended."
    return { clothing, pose, violence, selfHarm, combined, verdict, reason }
  }
}

function pickViolation(scores: ScanScores): StrikeViolation {
  if (scores.violence >= scores.clothing && scores.violence >= scores.selfHarm) {
    return StrikeViolation.GORE
  }
  if (scores.selfHarm >= scores.clothing) return StrikeViolation.SELF_HARM_CONTENT
  return StrikeViolation.EXPLICIT_SEXUAL
}

const COMMENT_PROMPT = `You are a content moderator for Gallery, an art platform.

Analyze this comment for TOS violations. Rate each category 1-10:

HATE_SPEECH: slurs, dehumanizing language targeting race/gender/religion/sexuality/disability/etc.
HARASSMENT: targeted attacks, threats of violence, doxxing personal information
SPAM: unsolicited ads, repetitive self-promotion, bot-like content, scam links
NSFW_SOLICITATION: sexual solicitation, explicit requests, grooming language

Combined score = floor((hateSpeech×30 + harassment×40 + spam×10 + nsfwSolicitation×20) / 10)
SAFE = combined 1-29, WARNING = 30-59, REMOVE = 60-100

Override rules:
- Any category = 10 → combined = 100, verdict = REMOVE
- harassment ≥ 8 → verdict = REMOVE (combined floor 80)
- hateSpeech ≥ 7 → verdict = REMOVE (combined floor 70)

Respond with ONLY a JSON object — no markdown, no code blocks:
{"hateSpeech":1,"harassment":1,"spam":1,"nsfwSolicitation":1,"combined":7,"verdict":"SAFE","reason":"one sentence"}`

interface CommentScores {
  hateSpeech: number
  harassment: number
  spam: number
  nsfwSolicitation: number
  combined: number
  verdict: "SAFE" | "WARNING" | "REMOVE"
  reason: string
}

async function callOpenRouterText(text: string): Promise<CommentScores> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.2-11b-vision-instruct",
        messages: [{ role: "user", content: `${COMMENT_PROMPT}\n\nComment: "${text}"` }],
      }),
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
  const data = await res.json()
  const raw: string = (data.choices?.[0]?.message?.content ?? "").trim()
  const clean = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()
  try {
    return JSON.parse(clean) as CommentScores
  } catch {
    const num = (key: string, fallback: number) => {
      const m = clean.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`))
      return m ? parseInt(m[1], 10) : fallback
    }
    const hateSpeech = num("hateSpeech", 1)
    const harassment = num("harassment", 1)
    const spam = num("spam", 1)
    const nsfwSolicitation = num("nsfwSolicitation", 1)
    const combined = num("combined", Math.floor((hateSpeech * 30 + harassment * 40 + spam * 10 + nsfwSolicitation * 20) / 10))
    const verdictMatch = clean.match(/"verdict"\s*:\s*"(SAFE|WARNING|REMOVE)"/)
    const verdict = (verdictMatch?.[1] ?? (combined >= 60 ? "REMOVE" : combined >= 30 ? "WARNING" : "SAFE")) as CommentScores["verdict"]
    const reasonMatch = clean.match(/"reason"\s*:\s*"([^"]*)"/)
    const reason = reasonMatch?.[1] ?? "AI response truncated."
    return { hateSpeech, harassment, spam, nsfwSolicitation, combined, verdict, reason }
  }
}

export async function scanComment(
  prisma: PrismaClient,
  commentId: string,
): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { text: true } })
  if (!comment) return

  let scores: CommentScores
  try {
    scores = await callOpenRouterText(comment.text)
  } catch (err) {
    console.error("[ai-scan] comment scan failed:", err)
    return
  }

  if (scores.verdict === "REMOVE") {
    try {
      await prisma.comment.update({
        where: { id: commentId },
        data: { hidden: true, hiddenReason: `AI scan (${scores.combined}/100): ${scores.reason}` },
      })
    } catch (err) {
      console.error("[ai-scan] comment hide failed:", err)
    }
  }
}

export async function scanShopItem(
  prisma: PrismaClient,
  itemId: string,
  userId: string,
  imageDataUrl: string,
): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return

  let scores: ScanScores
  try {
    scores = await callOpenRouter(imageDataUrl)
  } catch (err) {
    console.error("[ai-scan] OpenRouter call failed (shop):", err)
    try {
      await prisma.aIScanLog.create({
        data: { contentType: "SHOP_ITEM", contentId: itemId, scores: {}, verdict: "ERROR", action: `SCAN_ERROR: ${String(err)}` },
      })
    } catch {}
    return
  }

  const isZeroTolerance =
    scores.clothing === 10 || scores.pose === 10 || scores.violence === 10 || scores.selfHarm === 10
  const isSevere =
    !isZeroTolerance &&
    (scores.clothing === 9 || scores.pose === 9 || scores.violence === 9 || scores.selfHarm === 9)
  const isExplicit =
    !isZeroTolerance && !isSevere && (scores.clothing >= 7 || scores.violence >= 7 || scores.selfHarm >= 7)
  const isPoseOnly =
    !isZeroTolerance && !isSevere && !isExplicit && scores.pose >= 7

  let action: string
  let newStatus: string | null = null
  let strikeLevel: StrikeLevel | null = null
  let violation: StrikeViolation | null = null

  if (isZeroTolerance) {
    action = "REMOVED_ZERO_TOLERANCE"
    newStatus = "REMOVED"
    strikeLevel = StrikeLevel.ZERO_TOLERANCE
    violation = pickViolation(scores)
  } else if (isSevere) {
    action = "REMOVED_SEVERE"
    newStatus = "REMOVED"
    strikeLevel = StrikeLevel.SEVERE
    violation = pickViolation(scores)
  } else if (isExplicit) {
    action = "PENDING_REVIEW_EXPLICIT"
    newStatus = "PENDING_REVIEW"
    strikeLevel = StrikeLevel.MODERATE
    violation = pickViolation(scores)
  } else if (isPoseOnly) {
    action = "PENDING_REVIEW_POSE"
    newStatus = "PENDING_REVIEW"
  } else {
    action = "NONE"
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.shopItem.update({
        where: { id: itemId },
        data: {
          aiVerdict: scores.verdict,
          aiScores: scores as object,
          ...(newStatus ? { status: newStatus } : {}),
        },
      })

      if (strikeLevel && violation) {
        await tx.strike.create({
          data: {
            userId,
            aiIssued: true,
            level: strikeLevel,
            violation,
            contentId: itemId,
            contentType: "SHOP_ITEM",
            notes: `AI scan ${scores.combined}/100: ${scores.reason}`,
          },
        })
      }

      if (newStatus === "REMOVED") {
        await tx.notification.create({
          data: { userId, fromUserId: null, type: "post_removed_tos" },
        })
      } else if (newStatus === "PENDING_REVIEW") {
        await tx.notification.create({
          data: { userId, fromUserId: null, type: "post_pending_review" },
        })
      }

      await tx.aIScanLog.create({
        data: {
          contentType: "SHOP_ITEM",
          contentId: itemId,
          scores: scores as object,
          verdict: scores.verdict,
          action,
        },
      })
    })
  } catch (err) {
    console.error("[ai-scan] DB update failed (shop):", err)
  }
}

// Avatar and banner images are public everywhere — revert on anything SUGGESTIVE or worse.
// EXPLICIT also issues a zero-tolerance strike.
export async function scanAvatar(
  prisma: PrismaClient,
  userId: string,
  field: "image" | "bannerImage",
  imageDataUrl: string,
): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return

  let scores: ScanScores
  try {
    scores = await callOpenRouter(imageDataUrl)
  } catch (err) {
    console.error("[ai-scan] OpenRouter call failed (avatar):", err)
    try {
      await prisma.aIScanLog.create({
        data: { contentType: "AVATAR", contentId: userId, scores: {}, verdict: "ERROR", action: `SCAN_ERROR: ${String(err)}` },
      })
    } catch {}
    return
  }

  if (scores.verdict === "SAFE") return

  const isExplicit = scores.verdict === "EXPLICIT"
  const action = isExplicit ? "AVATAR_REMOVED_EXPLICIT" : "AVATAR_REMOVED_SUGGESTIVE"

  try {
    await prisma.$transaction(async (tx) => {
      // Revert the image to null
      await tx.user.update({
        where: { id: userId },
        data: { [field]: null },
      })

      if (isExplicit) {
        await tx.strike.create({
          data: {
            userId,
            aiIssued: true,
            level: StrikeLevel.ZERO_TOLERANCE,
            violation: StrikeViolation.EXPLICIT_SEXUAL,
            contentId: userId,
            contentType: "AVATAR",
            notes: `AI scan ${scores.combined}/100: ${scores.reason}`,
          },
        })
        await tx.notification.create({
          data: { userId, fromUserId: null, type: "post_removed_tos" },
        })
      }

      await tx.aIScanLog.create({
        data: {
          contentType: "AVATAR",
          contentId: userId,
          scores: scores as object,
          verdict: scores.verdict,
          action,
        },
      })
    })
  } catch (err) {
    console.error("[ai-scan] DB update failed (avatar):", err)
  }
}

export async function scanPost(
  prisma: PrismaClient,
  postId: string,
  userId: string,
  imageDataUrl: string,
): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return

  let scores: ScanScores
  try {
    scores = await callOpenRouter(imageDataUrl)
  } catch (err) {
    console.error("[ai-scan] OpenRouter call failed:", err)
    try {
      await prisma.aIScanLog.create({
        data: { contentType: "POST", contentId: postId, scores: {}, verdict: "ERROR", action: `SCAN_ERROR: ${String(err)}` },
      })
    } catch {}
    return
  }

  const isZeroTolerance =
    scores.clothing === 10 || scores.pose === 10 || scores.violence === 10 || scores.selfHarm === 10
  const isSevere =
    !isZeroTolerance &&
    (scores.clothing === 9 || scores.pose === 9 || scores.violence === 9 || scores.selfHarm === 9)
  const isExplicitNonPose =
    !isZeroTolerance && !isSevere && (scores.clothing >= 7 || scores.violence >= 7 || scores.selfHarm >= 7)
  const isPoseHighOnly =
    !isZeroTolerance && !isSevere && !isExplicitNonPose && scores.pose >= 7

  let action: string
  let newStatus: "PUBLISHED" | "PENDING_REVIEW" | "REMOVED" | null = null
  let strikeLevel: StrikeLevel | null = null
  let violation: StrikeViolation | null = null

  if (isZeroTolerance) {
    action = "REMOVED_ZERO_TOLERANCE"
    newStatus = "REMOVED"
    strikeLevel = StrikeLevel.ZERO_TOLERANCE
    violation = pickViolation(scores)
  } else if (isSevere) {
    action = "REMOVED_SEVERE"
    newStatus = "REMOVED"
    strikeLevel = StrikeLevel.SEVERE
    violation = pickViolation(scores)
  } else if (isExplicitNonPose) {
    action = "PENDING_REVIEW_EXPLICIT"
    newStatus = "PENDING_REVIEW"
    strikeLevel = StrikeLevel.MODERATE
    violation = pickViolation(scores)
  } else if (isPoseHighOnly) {
    action = "PENDING_REVIEW_POSE"
    newStatus = "PENDING_REVIEW"
  } else {
    action = "NONE"
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: {
          aiVerdict: scores.verdict,
          aiScores: scores as object,
          ...(newStatus === "REMOVED"
            ? { status: "REMOVED", removedAt: new Date(), removalReason: `AI scan: ${scores.reason}` }
            : newStatus === "PENDING_REVIEW"
              ? { status: "PENDING_REVIEW", pendingAt: new Date(), flagReason: `AI scan: ${scores.reason}` }
              : {}),
        },
      })

      if (strikeLevel && violation) {
        await tx.strike.create({
          data: {
            userId,
            aiIssued: true,
            level: strikeLevel,
            violation,
            contentId: postId,
            contentType: "POST",
            notes: `AI scan ${scores.combined}/100: ${scores.reason}`,
          },
        })
      }

      if (newStatus === "REMOVED") {
        await tx.notification.create({
          data: { userId, fromUserId: null, type: "post_removed_tos" },
        })
      } else if (newStatus === "PENDING_REVIEW") {
        await tx.notification.create({
          data: { userId, fromUserId: null, type: "post_pending_review" },
        })
      }

      await tx.aIScanLog.create({
        data: {
          contentType: "POST",
          contentId: postId,
          scores: scores as object,
          verdict: scores.verdict,
          action,
        },
      })
    })
  } catch (err) {
    console.error("[ai-scan] DB update failed:", err)
  }
}
