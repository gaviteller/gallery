import { Resend } from "resend"

const FROM = process.env.EMAIL_FROM ?? "Gallery <onboarding@resend.dev>"

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    // Dev fallback — log so you can still test locally without a key
    console.log(`\n────────────────────────────────────────`)
    console.log(`[VERIFY EMAIL]  To: ${to}`)
    console.log(`Link: ${verifyUrl}`)
    console.log(`────────────────────────────────────────\n`)
    return
  }

  const resend = new Resend(apiKey)

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Gallery account",
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:#070C1C;font-family:sans-serif;">
          <div style="max-width:480px;margin:40px auto;padding:40px;background:#0D1640;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
            <h1 style="margin:0 0 8px;font-size:26px;background:linear-gradient(135deg,#00D4FF,#6B5EFF,#00B4EE);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Gallery</h1>
            <h2 style="margin:0 0 16px;font-size:18px;color:#fff;font-weight:600;">Verify your email</h2>
            <p style="margin:0 0 28px;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">
              Thanks for signing up! Click below to verify your email address and activate your account.
            </p>
            <a href="${verifyUrl}"
               style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00D4FF,#6B5EFF,#00B4EE);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">
              Verify email address
            </a>
            <p style="margin:28px 0 0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
              This link expires in 24 hours. If you didn't sign up for Gallery, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
  })
}
