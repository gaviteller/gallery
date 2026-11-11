"use client"

import { useRouter } from "next/navigation"

const GRADIENT = "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)"

const sectionStyle: React.CSSProperties = { marginBottom: 28 }
const headingStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display',serif",
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text)",
  marginBottom: 8,
  paddingBottom: 6,
  borderBottom: "1px solid var(--border)",
}
const bodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
  lineHeight: 1.75,
  fontFamily: "Inter,sans-serif",
}
const listStyle: React.CSSProperties = {
  ...bodyStyle,
  paddingLeft: 18,
  margin: "6px 0",
}
const highlightStyle: React.CSSProperties = {
  borderLeft: "3px solid #784BA0",
  background: "rgba(120,75,160,0.08)",
  borderRadius: "0 8px 8px 0",
  padding: "10px 14px",
  margin: "10px 0",
  fontSize: 13,
  color: "var(--muted)",
  fontFamily: "Inter,sans-serif",
  lineHeight: 1.65,
}

export default function PrivacyPage() {
  const router = useRouter()

  return (
    <div style={{ flex: "1 0 auto", background: "var(--bg)", paddingBottom: 80 }}>
      {/* Nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--nav)", borderBottom: "1px solid var(--border)", padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)", display: "flex", flexShrink: 0 }}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Privacy Policy
        </div>
      </div>

      <div style={{ maxWidth: 512, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24, padding: "14px 16px", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Inter,sans-serif", lineHeight: 1.6 }}>
            Version 1.0 · Gallery, operated by Shomron Industries · Atlanta, Georgia, USA
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Inter,sans-serif", marginTop: 4 }}>
            Questions? Contact <span style={{ color: "var(--text)" }}>hello@gallery.app</span>
          </p>
        </div>

        {/* 1. Who we are */}
        <div style={sectionStyle}>
          <p style={headingStyle}>1. Who we are</p>
          <p style={bodyStyle}>Gallery is an art platform operated by Shomron Industries, based in Atlanta, Georgia, USA. We connect artists and buyers through a platform for sharing artwork, commissioning original pieces, and purchasing art through our shop.</p>
          <p style={{ ...bodyStyle, marginTop: 8 }}>This Privacy Policy applies to all users of the Gallery platform — artists and buyers alike.</p>
        </div>

        {/* 2. Data we collect */}
        <div style={sectionStyle}>
          <p style={headingStyle}>2. Data we collect</p>
          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>Account information</p>
          <ul style={listStyle}>
            <li>Name, display name, and username</li>
            <li>Email address and date of birth</li>
            <li>Profile photo and banner image</li>
            <li>Bio, website, and social media handles you choose to add</li>
            <li>Password (stored as a one-way hash — we cannot read it)</li>
          </ul>

          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4, marginTop: 12 }}>Activity on the platform</p>
          <ul style={listStyle}>
            <li>Posts you like, comment on, and share</li>
            <li>Artists you follow</li>
            <li>Commission requests you send or receive</li>
            <li>Messages between you and other users</li>
            <li>Shop purchases and browsing</li>
          </ul>

          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4, marginTop: 12 }}>Payment information</p>
          <p style={bodyStyle}>Payment card details are handled entirely by our payment provider. Gallery never sees or stores your raw card numbers. We retain only transaction amounts, dates, and outcomes for record-keeping.</p>

          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4, marginTop: 12 }}>Technical information</p>
          <ul style={listStyle}>
            <li>Device type, browser, and operating system</li>
            <li>IP address</li>
            <li>Push notification tokens (only if you enable notifications)</li>
          </ul>

          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4, marginTop: 12 }}>Location</p>
          <p style={bodyStyle}>Gallery uses your approximate location, derived from your IP address, to show location-relevant advertisements. You can opt out from Settings at any time.</p>
        </div>

        {/* 3. How we use your data */}
        <div style={sectionStyle}>
          <p style={headingStyle}>3. How we use your data</p>
          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>Running the platform</p>
          <p style={bodyStyle}>We use your account information to let you sign in, process commissions and purchases, send notifications about your account activity, and provide support.</p>

          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4, marginTop: 12 }}>Personalised recommendations</p>
          <p style={bodyStyle}>Your likes, follows, and browsing history are used to surface artists and content relevant to your taste. This is a core part of how Gallery works and cannot be opted out of while using the platform.</p>

          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4, marginTop: 12 }}>Content moderation</p>
          <p style={bodyStyle}>Flagged content may be reviewed by Gallery's moderation team and used to improve our automated moderation tools. These tools detect Terms of Service violations — they do not generate art.</p>
          <div style={highlightStyle}>Gallery never uses your artwork to train AI models that generate new art. Your work is yours.</div>

          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4, marginTop: 12 }}>Platform safety</p>
          <p style={bodyStyle}>Account data, IP addresses, and activity patterns are used to detect fraud, ban evasion, and other abusive behaviour.</p>

          <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--text)", marginBottom: 4, marginTop: 12 }}>Advertising</p>
          <p style={bodyStyle}>Gallery shows targeted ads based on the art styles you browse and your approximate location. We do not use sensitive personal information — such as religion, health, or politics — for ad targeting.</p>
        </div>

        {/* 4. We do not sell your data */}
        <div style={sectionStyle}>
          <p style={headingStyle}>4. We do not sell your data</p>
          <p style={bodyStyle}>Gallery does not sell your personal data to any third party.</p>
          <p style={{ ...bodyStyle, marginTop: 8 }}>Gallery produces anonymised trend reports covering popular art styles and categories on the platform. These reports contain no personal names, usernames, or any data that could identify you as an individual. This is not a sale of personal data.</p>
        </div>

        {/* 5. Third-party services */}
        <div style={sectionStyle}>
          <p style={headingStyle}>5. Third-party services</p>
          <p style={bodyStyle}>Gallery uses third-party providers for payments, image storage, hosting, email delivery, and content moderation. These providers process only the data necessary for their specific function and are not permitted to use your data for their own advertising or marketing purposes.</p>
          <p style={{ ...bodyStyle, marginTop: 8 }}>We do not share your private commission content or direct messages with any third party except where required by law or where you have raised a formal dispute.</p>
        </div>

        {/* 6. Cookies */}
        <div style={sectionStyle}>
          <p style={headingStyle}>6. Cookies</p>
          <p style={bodyStyle}>Gallery uses cookies to keep you signed in, remember your preferences, and deliver advertisements. Some cookies are essential for the platform to work and cannot be turned off. Non-essential cookies — such as advertising and analytics — can be managed from Settings.</p>
          <p style={bodyStyle}>To understand how Gallery is used, we count page visits. This does not use cookies: each visit is recorded with the page address, any search you typed on Explore, the website that linked you here, and an anonymous visitor code made from your connection and browser details plus the date. The code changes every day and cannot be used to identify you. If you are signed in, the visit is linked to your account.</p>
          <p style={bodyStyle}>To keep Gallery safe, the text of comments, direct messages, and commission chats, along with posted images, profile pictures, and shop listings, is checked automatically by an AI service. If something looks like it breaks our rules, a Gallery moderator is told and reviews it; the AI never removes, hides, or blocks content or penalises accounts on its own. Files sent in messages are not checked automatically.</p>
        </div>

        {/* 7. Data retention */}
        <div style={sectionStyle}>
          <p style={headingStyle}>7. Data retention</p>
          <ul style={listStyle}>
            <li><strong>Transaction records</strong> — kept for 7 years for legal and tax compliance</li>
            <li><strong>Moderation and strike history</strong> — kept indefinitely for platform safety</li>
            <li><strong>Everything else</strong> — deleted when you delete your account</li>
          </ul>
        </div>

        {/* 8. Your rights (CCPA) */}
        <div style={sectionStyle}>
          <p style={headingStyle}>8. Your rights (CCPA)</p>
          <p style={bodyStyle}>If you are a California resident, you have the following rights under the California Consumer Privacy Act:</p>
          <ul style={{ ...listStyle, marginTop: 8 }}>
            <li><strong>Right to know</strong> — request a copy of the personal information Gallery has collected about you</li>
            <li><strong>Right to delete</strong> — request deletion of your personal information, subject to legal retention requirements</li>
            <li><strong>Right to opt out of sale</strong> — Gallery does not sell your personal data, so this right is already satisfied</li>
            <li><strong>Right to non-discrimination</strong> — exercising your CCPA rights will never affect your ability to use Gallery</li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: 8 }}>To exercise any of these rights, contact us at <strong style={{ color: "var(--text)" }}>hello@gallery.app</strong>. We will respond within 45 days. If we need more time, we may extend this by an additional 45 days and will notify you of the extension.</p>
        </div>

        {/* 9. Children's privacy */}
        <div style={sectionStyle}>
          <p style={headingStyle}>9. Children's privacy</p>
          <p style={bodyStyle}>Gallery is not intended for users under the age of 13. If we discover an account belongs to someone under 13, we will delete that account and all associated data. If you believe a child under 13 has created a Gallery account, contact us at <strong style={{ color: "var(--text)" }}>hello@gallery.app</strong>.</p>
        </div>

        {/* 10. Data security */}
        <div style={sectionStyle}>
          <p style={headingStyle}>10. Data security</p>
          <p style={bodyStyle}>Gallery uses industry-standard security measures to protect your personal data, including encrypted connections and controlled internal access. Only authorised personnel can access user data, and only to the extent required for their role.</p>
          <p style={{ ...bodyStyle, marginTop: 8 }}>No system is completely secure. If a security incident occurs that affects your personal data, Gallery will notify you as soon as reasonably possible.</p>
        </div>

        {/* 11. Changes to this policy */}
        <div style={sectionStyle}>
          <p style={headingStyle}>11. Changes to this policy</p>
          <p style={bodyStyle}>If Gallery makes material changes to this Privacy Policy, we will notify you by email and in-app notification at least 30 days before the changes take effect. Continued use of Gallery after the effective date means you accept the updated policy. If you do not agree, you may close your account within the 30-day notice period.</p>
        </div>

        {/* 12. Contact us */}
        <div style={sectionStyle}>
          <p style={headingStyle}>12. Contact us</p>
          <p style={bodyStyle}>For privacy questions, data requests, or to exercise your rights:</p>
          <div style={{ marginTop: 10, padding: "12px 14px", background: "var(--surface)", borderRadius: 9, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>hello@gallery.app</p>
            <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>Gallery, operated by Shomron Industries · Atlanta, Georgia, USA</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif", textAlign: "center", lineHeight: 1.6 }}>
            Gallery Privacy Policy · Version 1.0<br />
            © 2026 Gallery. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
