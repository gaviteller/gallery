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
