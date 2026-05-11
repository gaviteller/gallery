import Link from "next/link"
import TermsContent from "@/components/TermsContent"

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 pb-24">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Terms of Service</h1>
        <p className="text-sm text-gray-500 italic">The Platform Built for Every Kind of Creator</p>
        <p className="text-xs text-gray-400 mt-2">Effective Date: 2026 · Version 1.0</p>
        <p className="text-xs text-gray-400">Gallery, operated by Shomron Industries · Atlanta, Georgia, USA</p>
        <p className="text-sm text-gray-600 mt-4 max-w-xl mx-auto">
          These Terms of Service govern your use of the Gallery platform. By creating an account or using Gallery, you agree to these terms. Please read them carefully.
        </p>
      </div>

      {/* Table of Contents */}
      <div className="bg-gray-50 rounded-2xl p-6 mb-10">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Table of Contents</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {[
            "Legal Foundations", "Accounts", "Content Rules", "Commission Rules",
            "Shop Rules", "Payments", "Moderation & Strikes", "Privacy & Data",
            "Intellectual Property", "Gallery Pro", "Liability & Disclaimers",
            "Work Protection", "Advertising", "Ratings & Trust Scores",
            "Trend Data", "Dispute Resolution", "Platform Availability", "General",
          ].map((title, i) => (
            <li key={i}>
              <a href={`#section-${i + 1}`} className="text-sm text-blue-600 hover:underline">
                <span className="text-blue-400 font-medium">{i + 1}.</span> {title}
              </a>
            </li>
          ))}
        </ol>
      </div>

      <TermsContent />

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-100 text-center text-xs text-gray-400 flex flex-col gap-1">
        <p>These Terms of Service were last updated in 2026.</p>
        <p>gallery.app · Gallery, operated by Shomron Industries · Atlanta, Georgia, USA</p>
        <p>© 2026 Gallery. All rights reserved.</p>
        <Link href="/signup" className="mt-3 text-blue-600 hover:underline text-sm">← Back to sign up</Link>
      </div>
    </div>
  )
}
