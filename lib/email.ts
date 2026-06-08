import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM ?? "Gallery <noreply@yourdomain.com>"
const GALLERY_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[email] skipped (no RESEND_API_KEY) → ${to} | ${subject}`)
    return
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
  } catch (err) {
    console.error("[email] send failed:", err)
  }
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0D0D0F;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0F;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#13101f;border:1px solid rgba(176,68,248,0.25);border-radius:10px;overflow:hidden;">
        <tr><td style="padding:28px 36px 20px;border-bottom:1px solid rgba(176,68,248,0.15);">
          <span style="font-size:20px;font-weight:800;color:#fff;">Gallery</span>
        </td></tr>
        <tr><td style="padding:32px 36px;">${body}</td></tr>
        <tr><td style="padding:20px 36px 28px;border-top:1px solid rgba(176,68,248,0.1);">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">
            You received this because you have a Gallery account.
            Visit <a href="${GALLERY_URL}" style="color:rgba(176,68,248,0.7);">gallery</a> for more info.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export async function sendPostAutoRemovedEmail(to: string, opts: { username: string }) {
  await send(to, "A post has been removed from your Gallery account", layout(
    "Post Auto-Removed",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">A post has been removed</h1>
     <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.username}, a post on your account that was flagged for review was not resolved within 14 days and has been automatically removed.</p>
     <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">If you believe this was removed in error, you can submit an appeal.</p>
     <a href="${GALLERY_URL}/appeal" style="display:inline-block;margin-top:24px;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Appeal this removal</a>`
  ))
}

export async function sendPasswordResetEmail(to: string, opts: {
  username: string
  token: string  // raw (unhashed) token
}) {
  const resetUrl = `${GALLERY_URL}/reset-password?token=${opts.token}`
  await send(to, "Reset your Gallery password", layout(
    "Reset your Gallery password",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Reset your password</h1>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.username}, we received a request to reset your Gallery password. Click the button below to choose a new one.</p>
     <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Reset password</a>
     <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,0.4);">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>`
  ))
}

export async function sendPostFlaggedEmail(to: string, opts: { username: string }) {
  await send(to, "One of your posts has been flagged for review", layout(
    "Post Flagged for Review",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Your post has been flagged</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.username}, one of your posts has received enough community reports to be placed under review. It remains visible on your profile while our team reviews it.</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">If the review is not resolved within 14 days, the post will be automatically removed. If it is removed and you believe this was a mistake, you can appeal.</p>
     <a href="${GALLERY_URL}/appeal" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Learn about appeals</a>`
  ))
}

export async function sendWelcomeEmail(to: string, opts: { username: string }) {
  await send(to, "Welcome to Gallery!", layout(
    "Welcome to Gallery",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Welcome to Gallery, @${opts.username}!</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Your account is ready. Start by uploading your first artwork, following artists you love, or opening commissions.</p>
     <a href="${GALLERY_URL}" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Go to Gallery</a>`
  ))
}

export async function sendCommissionRequestEmail(to: string, opts: { artistUsername: string; buyerUsername: string }) {
  await send(to, `@${opts.buyerUsername} sent you a commission request`, layout(
    "New Commission Request",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">New commission request</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.artistUsername}, <strong style="color:#fff;">@${opts.buyerUsername}</strong> has sent you a commission request. Head to your Professional DMs to review the brief and accept or decline.</p>
     <a href="${GALLERY_URL}/professional-dms" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">View request</a>`
  ))
}

export async function sendCommissionAcceptedEmail(to: string, opts: { buyerUsername: string; artistUsername: string; price: number; deadline: string }) {
  await send(to, `@${opts.artistUsername} accepted your commission`, layout(
    "Commission Accepted",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Your commission was accepted!</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.buyerUsername}, <strong style="color:#fff;">@${opts.artistUsername}</strong> has accepted your commission.</p>
     <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
       <tr><td style="padding:8px 0;font-size:14px;color:rgba(255,255,255,0.5);width:120px;">Agreed price</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#fff;">$${opts.price.toFixed(2)}</td></tr>
       <tr><td style="padding:8px 0;font-size:14px;color:rgba(255,255,255,0.5);">Deadline</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#fff;">${opts.deadline}</td></tr>
     </table>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Please confirm your payment in Professional DMs to get the commission started.</p>
     <a href="${GALLERY_URL}/professional-dms" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Confirm payment</a>`
  ))
}

export async function sendCommissionDeclinedEmail(to: string, opts: { buyerUsername: string; artistUsername: string }) {
  await send(to, `@${opts.artistUsername} declined your commission request`, layout(
    "Commission Declined",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Commission request declined</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.buyerUsername}, <strong style="color:#fff;">@${opts.artistUsername}</strong> has declined your commission request. You can browse other artists and send a new request.</p>
     <a href="${GALLERY_URL}/search" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Browse artists</a>`
  ))
}

export async function sendCommissionPaymentConfirmedEmail(to: string, opts: { artistUsername: string; buyerUsername: string }) {
  await send(to, `Payment received — commission is now in progress`, layout(
    "Payment Confirmed",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Payment confirmed</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.artistUsername}, <strong style="color:#fff;">@${opts.buyerUsername}</strong> has confirmed payment. Your commission is now in progress — get to work!</p>
     <a href="${GALLERY_URL}/professional-dms" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">View commission</a>`
  ))
}

export async function sendCommissionDeliveredEmail(to: string, opts: { buyerUsername: string; artistUsername: string }) {
  await send(to, `@${opts.artistUsername} delivered your commission`, layout(
    "Commission Delivered",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Your commission has been delivered!</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.buyerUsername}, <strong style="color:#fff;">@${opts.artistUsername}</strong> has delivered your commission. Please review the work and approve it to release payment.</p>
     <a href="${GALLERY_URL}/professional-dms" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Review delivery</a>`
  ))
}

export async function sendCommissionCompleteEmail(to: string, opts: { artistUsername: string; buyerUsername: string }) {
  await send(to, `Commission complete — payment released`, layout(
    "Commission Complete",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Commission complete!</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.artistUsername}, <strong style="color:#fff;">@${opts.buyerUsername}</strong> approved your delivery. Payment has been released. Congratulations on the completed commission!</p>
     <a href="${GALLERY_URL}/professional-dms" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">View commission</a>`
  ))
}

export async function sendCommissionCancelledEmail(to: string, opts: { username: string; cancelledByRole: "artist" | "buyer" }) {
  const cancellerLabel = opts.cancelledByRole === "artist" ? "the artist" : "the buyer"
  await send(to, `A commission was cancelled`, layout(
    "Commission Cancelled",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Commission cancelled</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.username}, a commission has been cancelled by ${cancellerLabel}. You can view the details in your Professional DMs.</p>
     <a href="${GALLERY_URL}/professional-dms" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">View commission</a>`
  ))
}

export async function sendCommissionDisputeEmail(to: string, opts: { username: string }) {
  await send(to, `A commission dispute has been raised`, layout(
    "Commission Dispute Raised",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Commission dispute raised</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.username}, a dispute has been raised on one of your commissions. The commission is now frozen pending moderation review. Our team will reach out with next steps.</p>
     <a href="${GALLERY_URL}/professional-dms" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">View commission</a>`
  ))
}

export async function sendDmcaCounterNoticeEmail(to: string, opts: { claimantName: string; counterNoticeText: string; postUrl: string }) {
  const excerpt = opts.counterNoticeText.length > 300 ? opts.counterNoticeText.slice(0, 300) + "…" : opts.counterNoticeText
  await send(to, `A counter-notice has been filed on your DMCA claim`, layout(
    "DMCA Counter-Notice Filed",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Counter-notice filed</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi ${opts.claimantName}, the user whose content was removed in response to your DMCA claim has filed a counter-notice. The post URL was: <span style="color:#b044f8;">${opts.postUrl}</span></p>
     <div style="margin:0 0 20px;padding:16px;background:rgba(255,255,255,0.05);border-left:3px solid rgba(176,68,248,0.5);border-radius:4px;">
       <p style="margin:0;font-size:14px;line-height:1.65;color:rgba(255,255,255,0.6);">${excerpt}</p>
     </div>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Under DMCA safe harbor provisions, the content will be restored after 14 days unless you notify Gallery that you have filed an action seeking a court order to restrain the alleged infringement.</p>`
  ))
}

export async function sendPostRestoredEmail(to: string, opts: { username: string }) {
  await send(to, "Your post has been restored", layout(
    "Post Restored",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Your post has been restored</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.username}, the 14-day counter-notice waiting period has elapsed with no court action from the claimant. Your post has been restored and is now visible on your profile.</p>
     <a href="${GALLERY_URL}/${opts.username}" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">View your profile</a>`
  ))
}
