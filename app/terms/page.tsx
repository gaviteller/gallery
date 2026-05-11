import Link from "next/link"

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

      <div className="flex flex-col gap-10 text-sm text-gray-700 leading-relaxed">

        {/* 1 */}
        <section id="section-1">
          <SectionTitle n="1" title="Legal Foundations" />
          <Sub title="1.1 Company & Governing Law">
            Gallery is operated by Shomron Industries, based in Atlanta, Georgia, USA. These Terms of Service are governed by the laws of the State of Georgia, without regard to conflict of law principles.
          </Sub>
          <Sub title="1.2 Global Compliance">
            <p>Gallery serves users worldwide and complies with the following data protection and privacy laws:</p>
            <BulletList items={[
              "General Data Protection Regulation (GDPR) — European Union",
              "California Consumer Privacy Act (CCPA) — United States",
              "Privacy Protection Law (PPL) — Israel",
              "Act on Protection of Personal Information (APPI) — Japan",
            ]} />
            <p>Where these laws impose stricter standards than US law, Gallery applies those stricter standards to all users globally.</p>
          </Sub>
          <Sub title="1.3 Age Requirements">
            You must be at least 13 years old to use Gallery. Users under 16 in the European Union require verifiable parental consent. By creating an account, you confirm you meet the applicable age requirement. Providing false age information is a violation of these Terms.
          </Sub>
          <Sub title="1.4 Acceptance of Terms">
            By creating a Gallery account or using the platform in any way, you agree to these Terms of Service in full. If you do not agree, you may not use Gallery.
          </Sub>
          <Sub title="1.5 Changes to Terms">
            Gallery may update these Terms at any time. Users will be notified via email and in-app notification at least 30 days before any changes take effect. Continued use of Gallery after the effective date constitutes acceptance of the updated Terms. If you disagree with changes, you may close your account within the 30-day notice period.
          </Sub>
          <Sub title="1.6 Dispute Resolution">
            Any dispute between you and Gallery will be resolved through binding arbitration as described in Section 16 (Dispute Resolution). All disputes are governed by the laws of the State of Georgia, USA.
          </Sub>
        </section>

        {/* 2 */}
        <section id="section-2">
          <SectionTitle n="2" title="Accounts" />
          <Sub title="2.1 Registration">
            You may register using your email address, Google account, or Apple ID. During registration, you will be asked whether you wish to enable selling and commission features. This can be changed at any time from your account Settings.
          </Sub>
          <Sub title="2.2 Account Responsibility">
            You are responsible for all activity that occurs under your account. Keep your login credentials secure. Gallery is not liable for losses caused by unauthorised access to your account.
          </Sub>
          <Sub title="2.3 One Account Per Person">
            Each person may maintain one Gallery account. Creating multiple accounts to evade a ban or suspension is a Zero Tolerance violation resulting in immediate permanent ban of all associated accounts.
          </Sub>
          <Sub title="2.4 Account Termination — Artist">
            If an artist&apos;s account is terminated by Gallery, all pending escrow funds from active commissions are returned in full to the buyer immediately.
          </Sub>
          <Sub title="2.5 Account Termination — Buyer">
            <p className="mb-3">If a buyer&apos;s account is terminated by Gallery, the following rules apply to any active commissions:</p>
            <table className="w-full border-collapse text-xs rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-3 py-2 text-left font-medium">Commission Stage</th>
                  <th className="px-3 py-2 text-left font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Request accepted, not yet paid", "Commission cancelled. No money involved."],
                  ["Paid — work not yet started", "Full refund to buyer."],
                  ["Paid — work in progress", "Full refund to buyer."],
                  ["Delivered and confirmed with proof", "50% refund to buyer, 50% paid to artist."],
                ].map(([stage, outcome], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-3 py-2 border border-gray-100">{stage}</td>
                    <td className="px-3 py-2 border border-gray-100">{outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sub>
          <Sub title="2.6 Ban Evasion">
            Creating a new account to evade a ban or suspension is a Zero Tolerance violation. Strike history is permanently tied to your email address. If you create a new account using the same email, all prior strikes carry over automatically.
          </Sub>
        </section>

        {/* 3 */}
        <section id="section-3">
          <SectionTitle n="3" title="Content Rules" />
          <Sub title="3.1 Free Expression on Gallery">
            Gallery supports free expression. You may share any idea, opinion, belief, or religious view on Gallery, provided it is expressed calmly, non-aggressively, and non-violently. The moment expression becomes an attack on a person or group, incites violence, or crosses into hate speech as defined below, it is no longer permitted on Gallery.
          </Sub>
          <Sub title="3.2 Prohibited Content">
            <p className="mb-2">The following content is strictly prohibited on Gallery:</p>
            <BulletList items={[
              "Explicit sexual content or nudity of any kind",
              "Sexual acts or implied sexual acts",
              "Content involving minors in any sexual or violent context — Zero Tolerance",
              "Gratuitous gore with no artistic context — content that exists purely for shock value",
              "Content targeting, dehumanising, or calling for violence against any person or group",
              "Content supporting, promoting, or glorifying organisations designated as terrorist groups by the United States government",
              "Credible threats of real-world violence against any person",
              "Content that glorifies or celebrates real-world deaths, attacks, or suffering",
              "Harassment in any form — see Section 3.5",
              "Unsolicited explicit content sent to any user",
              "Predatory behaviour toward any user",
              "Doxxing — sharing another person's private real-world information without consent",
              "Impersonation of another artist, user, or public figure",
              "Blackmail or extortion",
            ]} />
          </Sub>
          <Sub title="3.3 Allowed Content">
            <p className="mb-2">The following content is permitted on Gallery:</p>
            <BulletList items={[
              "Suggestive or lewd content, including revealing clothing and suggestive poses, provided no nudity or sexual acts are depicted",
              "Artistic violence and gore within a clear narrative or fictional context — including dark fantasy, horror, and manga-style action",
              "Political art and social commentary, provided it does not cross into hate speech or incitement",
              "Fan art of existing characters and IP — subject to Section 9 (Intellectual Property)",
              "AI-assisted art where the artist has contributed significant original creative input, provided it is clearly labelled",
            ]} />
          </Sub>
          <Sub title="3.4 Violence & Gore — Where the Line Is">
            <p className="mb-2">Artistic violence with blood and gore in a clear fictional or narrative context is permitted. The following content is not:</p>
            <BulletList items={[
              "Gore with no artistic context — dismemberment, organs, or graphic injury for shock value alone",
              "Detailed realistic depictions of real-world violence against named or identifiable individuals",
              "Content celebrating real-world deaths or attacks",
              "Any gore or violence involving children, whether fictional or not — Zero Tolerance",
            ]} />
            <p className="text-xs text-gray-400 italic mt-2">Note: Real people and real events are held to a significantly stricter standard. Artistic context must be clear and non-celebratory.</p>
          </Sub>
          <Sub title="3.5 Harassment — Definition">
            <p className="mb-2">Harassment on Gallery includes but is not limited to:</p>
            <BulletList items={[
              "Attacking or targeting a user because of their interests, fandoms, or the art they create or commission",
              "Destructive criticism with no constructive value — comments designed to tear someone down rather than help them improve",
              "Continuing to contact a user after they have asked you to stop",
              "Targeted personal attacks via Direct Messages",
              "Sending unsolicited explicit content to any user — Zero Tolerance",
              "Predatory behaviour toward any user — Zero Tolerance",
            ]} />
            <p className="text-xs text-gray-400 italic mt-2">Note: Criticism is welcome on Gallery. The distinction is intent and constructive value. &ldquo;This piece doesn&apos;t work for me, here is why and how it could improve&rdquo; is criticism. &ldquo;This is terrible, you should quit&rdquo; is harassment.</p>
          </Sub>
          <Sub title="3.6 Hate Speech — Definition">
            <p className="mb-2">Hate speech on Gallery is any content that:</p>
            <BulletList items={[
              "Attacks, dehumanises, or calls for violence against a person or group based on race, ethnicity, religion, gender, sexual orientation, disability, or nationality",
              "Uses slurs to attack individuals or groups",
              "Denies or glorifies genocide or crimes against humanity",
              "Portrays a group as subhuman or inherently inferior",
            ]} />
            <p className="mb-2 mt-3">The following is not considered hate speech:</p>
            <BulletList items={[
              "Criticism of ideologies, religions, or beliefs, provided it targets the idea rather than the people",
              "Satire or artistic commentary on social issues",
              "Sharing factual information even if uncomfortable",
              "Personal opinions that are offensive but do not target a protected group",
            ]} />
          </Sub>
          <Sub title="3.7 AI Art Policy">
            <p>AI-assisted art is permitted on Gallery provided it is clearly labelled as AI-assisted. AI-generated art that replicates or is clearly derived from a specific artist&apos;s style without their consent is prohibited.</p>
            <BulletList items={[
              "Unlabelled AI art: warning first, then Minor strike for repeat offences",
              "AI art that steals another artist's style or work: Severe strike",
            ]} />
            <p className="mt-2">Burden of proof for AI style theft lies with the reporter. Gallery reviews submitted evidence and makes a decision.</p>
          </Sub>
          <Sub title="3.8 Content Involving Minors">
            Any content violation involving minors is automatically elevated one full severity level. Any sexual or gore content involving minors, whether fictional or real, is a Zero Tolerance violation resulting in immediate permanent ban and reporting to relevant authorities.
          </Sub>
          <Sub title="3.9 Fan Art & Legal Liability">
            Fan art is permitted on Gallery. Artists are solely responsible for the legal consequences of any fan art they create or sell, including IP claims from rights holders such as Nintendo or Disney. Gallery&apos;s legal responsibility for fan art is limited to DMCA compliance. Exception: if Gallery actively uses an artist&apos;s fan art in its own marketing or advertising materials, legal responsibility for resulting IP claims shifts to Gallery.
          </Sub>
        </section>

        {/* 4 */}
        <section id="section-4">
          <SectionTitle n="4" title="Commission Rules" />
          <Sub title="4.1 The Commission Flow">
            <p className="mb-2">Commissions on Gallery follow a structured process:</p>
            <BulletList items={[
              "Buyer submits a commission request with a brief and optional requested completion date",
              "Artist accepts or declines within 3 days. Unanswered requests are automatically cancelled after 3 days and the buyer is notified",
              "Artist sets a price and optional estimated completion timeline",
              "Buyer agrees to the price and pays. Funds are held in escrow",
              "Artist completes the work and marks it as delivered",
              "Buyer has 5 days to confirm delivery or raise a Terms of Service concern",
              "If the buyer does not respond within 5 days, escrow is automatically released to the artist",
              "If a ToS violation is raised, the commission is frozen pending moderation review",
            ]} />
          </Sub>
          <Sub title="4.2 Price Changes">
            An artist may adjust the commission price at any point before payment is made. The buyer is notified of any price change and may cancel the commission for free if they do not agree to the new price.
          </Sub>
          <Sub title="4.3 Cancellation Rules">
            <table className="w-full border-collapse text-xs rounded-xl overflow-hidden mt-2 mb-3">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-3 py-2 text-left font-medium">Stage</th>
                  <th className="px-3 py-2 text-left font-medium">Who Cancels</th>
                  <th className="px-3 py-2 text-left font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Before payment", "Either party", "Free cancellation, no consequences"],
                  ["After payment — mutual", "Both agree", "Full refund to buyer"],
                  ["After payment — artist cancels", "Artist only", "Full refund to buyer + strike against artist"],
                  ["After payment — buyer cancels", "Buyer only", "Full refund to buyer + counts against buyer cancellation record"],
                  ["After delivery", "Neither", "No cancellation. ToS dispute only."],
                ].map(([stage, who, outcome], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-3 py-2 border border-gray-100">{stage}</td>
                    <td className="px-3 py-2 border border-gray-100">{who}</td>
                    <td className="px-3 py-2 border border-gray-100">{outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>A buyer who accumulates 3 or more total cancellations will have this displayed on their profile so artists can make informed decisions before accepting their requests.</p>
          </Sub>
          <Sub title="4.4 Commission Violations">
            <p className="mb-2">The following are violations of Gallery&apos;s commission rules:</p>
            <BulletList items={[
              "False advertising — displaying example work that does not accurately represent the artist's actual skill level. First offence: warning + Gallery issues buyer a platform credit. Second offence: Minor strike. Repeat: commission feature permanently disabled.",
              "Bait and switch — agreeing to one thing in the brief and delivering something materially different. Must be raised within the 5-day delivery window for Gallery to act.",
              "Off-platform payment requests — asking buyers to pay outside Gallery to avoid fees. Minor strike. Repeat: commission ban.",
              "Fake delivery — marking a commission as delivered without delivering the agreed work. Moderate strike. Repeat: Severe strike and possible ban.",
              "Blackmail or extortion — threatening to withhold, leak, or misuse work to extract additional payment. Zero Tolerance.",
              "Commission farming — repeatedly accepting commissions beyond capacity and failing to deliver within the artist's own stated timeline. Minor strike and temporary commission suspension. Repeat: permanent commission ban.",
            ]} />
          </Sub>
          <Sub title="4.5 Repeat Commission Cancellations">
            An artist who cancels 5 or more accepted commissions within a single calendar month will have their commission feature permanently disabled. This decision is appealable.
          </Sub>
          <Sub title="4.6 Dispute Resolution Within Commissions">
            Gallery does not mediate disputes about subjective quality. Gallery will act only where a clear Terms of Service violation has occurred. All disputes must be raised within the 5-day delivery window before escrow is released. Gallery may, at its sole discretion, issue a partial refund in cases of extreme and clearly evidenced misconduct after escrow release.
          </Sub>
        </section>

        {/* 5 */}
        <section id="section-5">
          <SectionTitle n="5" title="Shop Rules" />
          <Sub title="5.1 Premade Art Listings">
            Artists may list finished pieces for direct sale. The same false advertising, bait and switch, and content rules that apply to commissions apply equally to shop listings.
          </Sub>
          <Sub title="5.2 Digital Downloads">
            All digital file sales are final. No refunds are issued once a digital file has been downloaded by the buyer.
          </Sub>
          <Sub title="5.3 Physical Pieces — Shipping">
            <p className="mb-2">Artists selling physical pieces must provide proof of shipping with a valid tracking number. Gallery&apos;s 30-day confirmation system applies to all physical sales:</p>
            <BulletList items={[
              "After 30 days, Gallery contacts the buyer to confirm receipt",
              "If confirmed received: escrow releases to artist",
              "If not received and artist has proof of good condition at time of shipping: shipping carrier is responsible. Gallery mediates but cannot force a refund.",
              "If not received and artist cannot provide proof of shipping: artist is responsible and must offer a replacement or refund",
            ]} />
          </Sub>
          <Sub title="5.4 Damaged or Lost Items">
            Damage or loss that occurs in transit is the shipping carrier&apos;s responsibility where the artist can prove the item was shipped in good condition. Gallery will assist in mediation but is not financially liable for third-party shipping failures.
          </Sub>
        </section>

        {/* 6 */}
        <section id="section-6">
          <SectionTitle n="6" title="Payments" />
          <Sub title="6.1 Transaction Fees">
            <p className="mb-2">Gallery charges a transaction fee on all commissions and sales processed through the platform:</p>
            <BulletList items={[
              "Standard fee: 8% of the total transaction value",
              "Gallery Pro fee: 5% of the total transaction value",
            ]} />
          </Sub>
          <Sub title="6.2 Escrow">
            All commission and shop payments are processed through Gallery&apos;s third-party payment provider and held in escrow until the transaction is confirmed complete. Gallery does not hold user funds directly. Funds are released to the artist upon buyer confirmation or automatic release after 5 days of no buyer response following delivery.
          </Sub>
          <Sub title="6.3 Payouts">
            Payouts to artists are processed immediately upon escrow release, provided no disputes, flags, or account suspensions are active on the account.
          </Sub>
          <Sub title="6.4 Taxes">
            Artists are solely responsible for reporting and paying all applicable taxes on income earned through Gallery. Gallery does not withhold taxes on behalf of artists. Gallery may introduce tax assistance tools in future platform phases but makes no current guarantee of such features.
          </Sub>
          <Sub title="6.5 Chargebacks">
            <p className="mb-2">A chargeback occurs when a user reverses a payment through their bank or card provider, bypassing Gallery&apos;s platform. Gallery treats fraudulent chargebacks as a serious violation:</p>
            <BulletList items={[
              "Account suspended immediately pending investigation",
              "If chargeback is found to be fraudulent: permanent ban",
              "User owes Gallery the chargeback fee plus the original transaction amount",
              "Repeat or large-scale chargeback fraud may result in legal action",
              "Legitimate chargebacks (genuine fraud, stolen card): account reviewed case by case and restored where the user can prove they did not authorise the transaction",
            ]} />
          </Sub>
        </section>

        {/* 7 */}
        <section id="section-7">
          <SectionTitle n="7" title="Moderation & Strikes" />
          <Sub title="7.1 The Three-Layer Moderation System">
            <BulletList items={[
              "Layer 1 — AI scan: every upload is scanned automatically on submission",
              "Layer 2 — Community reports: users can report any post or content",
              "Layer 3 — Account enforcement: violations accumulate as strikes",
            ]} />
          </Sub>
          <Sub title="7.2 Content Pending State">
            When the AI flags content, it enters a Pending state visible only to the poster. The poster receives an email notification and has 14 days to challenge or self-remove the content. After 14 days, the content is automatically removed. Users may still challenge a removal after the 14-day window and Gallery may restore content if the challenge is upheld.
          </Sub>
          <Sub title="7.3 Strike Levels & Consequences">
            <table className="w-full border-collapse text-xs rounded-xl overflow-hidden mt-2">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-3 py-2 text-left font-medium">Level</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Trigger for Temp Ban</th>
                  <th className="px-3 py-2 text-left font-medium">Examples</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["1", "Minor", "6 strikes within 30 days → 3-day temp ban", "Spam, low-level harassment, glorifying self-harm, unlabelled AI art (repeat)"],
                  ["2", "Moderate", "4 strikes within 30 days → 14-day temp ban", "Targeted harassment, hate speech, explicit NSFW, gratuitous gore, support for terrorist organisations"],
                  ["3", "Severe", "1 strike → 30-day temp ban; 2 strikes ever → permanent ban", "Unlabelled AI art (repeat serious), work theft, doxxing, credible threats, coordinated harassment"],
                  ["4", "Zero Tolerance", "Instant permanent ban", "CSAM, predatory behaviour, unsolicited explicit content, blackmail, impersonation, gore/violence involving children"],
                ].map(([level, name, trigger, examples], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-3 py-2 border border-gray-100 font-semibold">{level}</td>
                    <td className="px-3 py-2 border border-gray-100">{name}</td>
                    <td className="px-3 py-2 border border-gray-100">{trigger}</td>
                    <td className="px-3 py-2 border border-gray-100">{examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sub>
          <Sub title="7.4 Content Involving Minors">
            Any violation involving minors is automatically elevated one full severity level. Any sexual or gore content involving minors, whether fictional or not, is a Zero Tolerance violation.
          </Sub>
          <Sub title="7.5 Appeals">
            All moderation decisions, including permanent bans, are appealable. Artists may challenge any content removal or account action. A human reviewer separate from the original moderation decision assesses all appeals within 5 business days. If the appeal is upheld, content is restored and no strike is recorded. All decisions are communicated with a clear reason.
          </Sub>
        </section>

        {/* 8 */}
        <section id="section-8">
          <SectionTitle n="8" title="Privacy & Data" />
          <Sub title="8.1 Data We Collect">
            <p className="mb-2">Gallery collects the following information to operate the platform:</p>
            <BulletList items={[
              "Account information: name, email address, date of birth",
              "Payment information: processed and stored securely through our payment provider",
              "Browse behaviour: posts you view, like, share, and commission — used to power the recommendation system",
              "Device information: device type, browser, operating system",
              "IP address",
              "Location data: used for advertising targeting (see Section 13)",
            ]} />
          </Sub>
          <Sub title="8.2 How We Use Your Data">
            <BulletList items={[
              "Browse behaviour and commission history are used to build your personal style profile, which powers Gallery's recommendation engine. Processing for the recommendation system is carried out on the legal basis of legitimate interests under GDPR Article 6(1)(f).",
              "Content patterns and flagged posts are used to train and improve Gallery's moderation AI. This AI detects Terms of Service violations — it does not generate art.",
              "Gallery never uses your artwork to train AI models that generate new art.",
              "Gallery never sells your personal data to third parties.",
            ]} />
            <p className="mt-2">Your participation in the recommendation system is a core part of how Gallery works and cannot be opted out of. You may opt out of location-based advertising targeting at any time from your account Settings.</p>
          </Sub>
          <Sub title="8.3 Third Party Services">
            Gallery uses third-party services for payments, real-time messaging, and file storage. These services may process certain user data as necessary to provide their functions. Gallery does not sell data to these services. All third-party providers are contractually bound to handle your data in accordance with applicable privacy laws.
          </Sub>
          <Sub title="8.4 Cookies">
            <p className="mb-2">Gallery uses four types of cookies:</p>
            <BulletList items={[
              "Essential cookies: required for the platform to function. Cannot be opted out of.",
              "Analytics cookies: help Gallery understand how users interact with the platform.",
              "Advertising cookies: support targeted ad delivery.",
              "Preference cookies: remember your settings and personalisation choices.",
            ]} />
            <p className="mt-2">EU users will be presented with a cookie consent banner for non-essential cookies. All users may manage cookie preferences from their account Settings.</p>
          </Sub>
          <Sub title="8.5 Data Retention">
            <BulletList items={[
              "Financial and transaction records: retained for 7 years for legal and tax compliance",
              "Strike history: retained indefinitely, tied to your email address, for platform safety and abuse prevention purposes",
              "Deleted content: retained for 12 months after deletion for legal purposes, then permanently purged",
              "Inactive accounts: retained indefinitely unless you request deletion",
            ]} />
          </Sub>
          <Sub title="8.6 Your Rights">
            <p className="mb-2">You may at any time:</p>
            <BulletList items={[
              "Request a download of all personal data Gallery holds about you",
              "Request deletion of your account and personal data. Financial records, strike history, and any data required for legal compliance will be retained as outlined above.",
            ]} />
            <p className="mt-2">EU users have additional rights under GDPR including the right to access, correct, restrict, and object to processing of their data. Users in California, Israel, and Japan have equivalent rights under applicable local law.</p>
          </Sub>
          <Sub title="8.7 Data Security & Access">
            Gallery uses industry-standard security measures to protect your data. Internal access to user data is role-based — only employees who require specific data to perform their job function may access it. A moderator reviewing content violations cannot access payment records.
          </Sub>
          <Sub title="8.8 Cross-Border Data Transfers">
            Gallery is based in the United States. Your data may be transferred to and processed in countries outside your own. International transfers of EU/EEA personal data are made pursuant to Standard Contractual Clauses (SCCs) approved by the European Commission, or another valid transfer mechanism under Chapter V of the GDPR.
          </Sub>
          <Sub title="8.9 Data Breaches">
            In the event of a data breach that affects your personal information, Gallery will notify affected users as soon as possible and notify relevant authorities within 72 hours of discovering the breach, in accordance with GDPR requirements.
          </Sub>
          <Sub title="8.10 Privacy Policy Changes">
            Gallery will provide at least 30 days&apos; notice before any changes to this Privacy section take effect, via email and in-app notification. Users who do not agree with the changes may close their account within the notice period.
          </Sub>
        </section>

        {/* 9 */}
        <section id="section-9">
          <SectionTitle n="9" title="Intellectual Property" />
          <Sub title="9.1 Artist Ownership">
            Artists retain full copyright ownership of all work they post on Gallery. By posting on Gallery, you grant Gallery a non-exclusive, royalty-free licence to display your work on the platform and use it in Gallery&apos;s marketing and promotional materials. This is a licence to display — not to own, sell, or transfer your work.
          </Sub>
          <Sub title="9.2 Promotional Use & Compensation">
            Where Gallery wishes to actively feature an artist&apos;s work in its own advertising or promotional campaigns, Gallery will seek the artist&apos;s explicit permission before doing so and will make a reasonable effort to compensate the artist. Where Gallery uses fan art in marketing materials and this results in an IP claim from a rights holder, legal responsibility shifts to Gallery, not the artist.
          </Sub>
          <Sub title="9.3 Commissioned Work">
            By default, artists retain copyright on all commissioned work. The buyer receives the commissioned file for personal use only. Copyright transfers to the buyer only if explicitly agreed upon in writing within the commission brief. Artists may display their commissioned work in their Gallery portfolio regardless of who commissioned it.
          </Sub>
          <Sub title="9.4 Commercial Licences">
            Buyers who wish to use commissioned or purchased work for commercial purposes — including merchandise, prints, or derivative works — must obtain explicit permission from the artist. Gallery provides an in-platform commercial licence request feature allowing buyers to formally request and agree licensing terms directly with the artist.
          </Sub>
          <Sub title="9.5 Reselling">
            Reselling art purchased on Gallery through Gallery&apos;s platform is prohibited. What buyers do with their purchases outside of Gallery is beyond Gallery&apos;s control and legal responsibility.
          </Sub>
          <Sub title="9.6 DMCA & Copyright Takedowns">
            Gallery complies with the Digital Millennium Copyright Act (DMCA). If you believe your work has been posted on Gallery without your permission, you may submit a takedown request through Gallery&apos;s dedicated DMCA form. Gallery will respond within 14 days. Artists whose work is removed have the right to file a counter-notice if they believe the takedown was wrongful. Gallery will review counter-notices within 14 days. Users who receive 3 confirmed copyright violation findings will have their account permanently terminated.
          </Sub>
          <Sub title="9.7 Fan Art Liability">
            Fan art of copyrighted characters and properties is permitted on Gallery. Artists are solely responsible for any legal consequences arising from their fan art, including IP claims from rights holders. Gallery&apos;s liability is limited to DMCA compliance response.
          </Sub>
        </section>

        {/* 10 */}
        <section id="section-10">
          <SectionTitle n="10" title="Gallery Pro" />
          <Sub title="10.1 What Gallery Pro Includes">
            Gallery Pro is a paid subscription for artists who want to build a career through the platform. Pro includes a reduced transaction fee of 5% (versus the standard 8%), early access to new features, and an expanding set of career-focused tools. Gallery Pro is for individual accounts only.
          </Sub>
          <Sub title="10.2 Pricing & Billing">
            The Gallery Pro subscription price is listed on the Gallery website. Gallery will provide at least 30 days&apos; notice before any price increase. Existing subscribers will receive one final month at their current price before the new price takes effect.
          </Sub>
          <Sub title="10.3 Free Trials">
            Gallery offers free trial periods at its discretion, including standard trials for new users, extended trials for early adopters, and promotional trials for partners. Trial length varies by program.
          </Sub>
          <Sub title="10.4 Cancellation">
            You may cancel Gallery Pro at any time. Pro benefits continue until the end of the current billing period. No refunds are issued for partial months.
          </Sub>
          <Sub title="10.5 Failed Payments">
            If a subscription payment fails, a 1-month grace period applies. During the grace period, the transaction fee increases from 5% to 7%. If payment is not resolved within 1 month, Pro benefits are suspended and the standard 8% fee applies.
          </Sub>
          <Sub title="10.6 Pro & Account Suspension">
            If a Pro subscriber&apos;s account is temporarily suspended, the Pro subscription is paused and cancelled at the end of that billing month. If a Pro subscriber receives a permanent ban, their subscription is cancelled immediately with no refund.
          </Sub>
          <Sub title="10.7 Feature Changes">
            Gallery will provide at least 30 days&apos; notice before removing or significantly changing any Gallery Pro feature.
          </Sub>
        </section>

        {/* 11 */}
        <section id="section-11">
          <SectionTitle n="11" title="Liability & Disclaimers" />
          <Sub title="11.1 Platform Provided &ldquo;As Is&rdquo;">
            Gallery is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied. Gallery does not guarantee that the platform will meet every user&apos;s specific needs or expectations.
          </Sub>
          <Sub title="11.2 Quality Disclaimer">
            Gallery facilitates transactions between artists and buyers but does not guarantee the quality of work delivered. Gallery is not responsible for subjective quality judgements. Gallery will act where there is clear evidence that delivered work does not match what was promised under these Terms.
          </Sub>
          <Sub title="11.3 Maximum Liability">
            To the fullest extent permitted by law, Gallery&apos;s total liability to any user for any claim arising from use of the platform is limited to the total amount that user has paid to Gallery in the 12 months preceding the claim.
          </Sub>
          <Sub title="11.4 Gallery's Fault vs. Platform Risk">
            Where a loss is directly caused by Gallery&apos;s own negligence or wilful misconduct, Gallery will compensate the affected user up to the cap set out in Section 11.3. Gallery is not liable for any indirect, incidental, special, or consequential damages — including lost income, lost data, or business interruption — where such damages are not directly caused by Gallery&apos;s own fault.
          </Sub>
          <Sub title="11.5 Indemnification">
            You agree to indemnify and hold Gallery harmless from any claims, damages, or legal costs arising from your use of the platform, your content, or your violation of these Terms.
          </Sub>
          <Sub title="11.6 Force Majeure">
            Gallery is not liable for failure to perform its obligations where such failure results from events beyond its reasonable control, including natural disasters, government actions, wars, pandemics, or third-party infrastructure failures.
          </Sub>
          <Sub title="11.7 Third-Party Services">
            Gallery uses third-party services for core platform functions including payments, messaging, and storage. Gallery&apos;s liability for failures of third-party services will be defined in accordance with Gallery&apos;s contractual agreements with those providers.
          </Sub>
        </section>

        {/* 12 */}
        <section id="section-12">
          <SectionTitle n="12" title="Work Protection" />
          <Sub title="12.1 Screenshot Blocking & Watermarking">
            Gallery implements screenshot blocking and automatic watermarking on all artwork posted to the platform. Every piece of art posted on Gallery is watermarked with the format: Gallery | @username. Gallery commits to implementing all technically feasible protection measures available. No system is completely unbreakable and Gallery cannot guarantee absolute protection against all circumvention methods.
          </Sub>
          <Sub title="12.2 Circumvention Violations">
            <p className="mb-2">The following are Moderate strike violations:</p>
            <BulletList items={[
              "Bypassing Gallery's screenshot protection by any means",
              "Using third-party software or browser extensions designed to circumvent Gallery's content protection",
              "Removing, altering, or obscuring Gallery watermarks from any artwork",
            ]} />
          </Sub>
          <Sub title="12.3 Sharing Downloaded Art">
            Buyers who receive commissioned or purchased art files may not share those files publicly without the artist&apos;s explicit permission. Violation is the buyer&apos;s legal responsibility.
          </Sub>
          <Sub title="12.4 DMCA Process">
            Artists who discover their work has been posted elsewhere without permission may submit a DMCA takedown request to Gallery through the dedicated DMCA form. Gallery will respond within 14 days and assist with the takedown process. Three confirmed copyright violations result in permanent account termination.
          </Sub>
        </section>

        {/* 13 */}
        <section id="section-13">
          <SectionTitle n="13" title="Advertising" />
          <Sub title="13.1 How Advertising Works on Gallery">
            Gallery displays targeted advertisements to all users. Ads are targeted based on art-related data only — including art styles you browse, mediums you engage with, and location. Gallery does not use sensitive personal categories such as religion, politics, health, or ethnicity for ad targeting.
          </Sub>
          <Sub title="13.2 Ad Targeting & Opt Out">
            You may opt out of location-based advertising targeting at any time from your account Settings. Opting out of location targeting does not remove all ads — you will still see ads targeted by art preferences.
          </Sub>
          <Sub title="13.3 Minors & Advertising">
            Users under the age of 13 will not be shown targeted advertisements. Users under 16 in the European Union will be shown generic, non-targeted advertisements only.
          </Sub>
          <Sub title="13.4 Advertiser Approval">
            Gallery reviews and approves all advertisers before their ads go live. Gallery retains the right to reject any advertiser at its sole discretion. All advertisements must comply with the same content rules as user-posted content.
          </Sub>
          <Sub title="13.5 Ad Labelling">
            All paid advertisements are clearly labelled as &ldquo;Sponsored&rdquo; so users can always distinguish paid content from organic content.
          </Sub>
          <Sub title="13.6 Advertiser Data">
            Advertisers receive anonymised performance metrics only, including impressions, clicks, and engagement rates. No personal user data is shared with or sold to advertisers.
          </Sub>
          <Sub title="13.7 Influencer & Sponsored Content">
            Artists who are paid or compensated by a brand to post about their products on Gallery must clearly disclose this as sponsored content, in accordance with the U.S. Federal Trade Commission (FTC) guidelines. Failure to disclose sponsored content is a Minor strike violation.
          </Sub>
          <Sub title="13.8 No Retargeting Outside Gallery">
            Gallery&apos;s advertising system operates entirely within the platform. Advertisers may not use Gallery data to retarget users on external platforms or websites.
          </Sub>
        </section>

        {/* 14 */}
        <section id="section-14">
          <SectionTitle n="14" title="Ratings & Trust Scores" />
          <Sub title="14.1 How Ratings Work">
            Buyers may rate artists after a commission is completed. Ratings are public and displayed on the artist&apos;s profile alongside the buyer&apos;s name. Buyers have 24 hours after commission completion to submit or edit their rating. After 24 hours the rating is locked permanently.
          </Sub>
          <Sub title="14.2 Trust Score">
            An artist&apos;s Trust Score is a composite of their average buyer rating, their commission cancellation rate, and any selling-related strikes on their account. The Trust Score is displayed publicly on an artist&apos;s profile once they have completed 10 commissions. Before reaching 10 completions, the profile shows &ldquo;New Artist.&rdquo;
          </Sub>
          <Sub title="14.3 Buyer Cancellation Record">
            Artists can view a buyer&apos;s total commission cancellation count before accepting a request. There is no formal buyer Trust Score.
          </Sub>
          <Sub title="14.4 Disputing a Rating">
            Artists may appeal a rating they believe is unfair or retaliatory by submitting a dispute with supporting evidence. Gallery reviews the evidence and may uphold the rating, remove it if found to be in bad faith, or escalate for senior review. Gallery will not adjust a rating downward as a result of an appeal. Leaving a retaliatory rating is a Minor strike violation.
          </Sub>
        </section>

        {/* 15 */}
        <section id="section-15">
          <SectionTitle n="15" title="Trend Data" />
          <Sub title="15.1 What Trend Data Is">
            Gallery produces quarterly anonymised trend reports covering popular art styles, mediums, and rising artist categories. These reports are made available for purchase to businesses and brands. Any business may purchase trend reports — no exclusivity arrangements are offered.
          </Sub>
          <Sub title="15.2 What Is and Is Not Included">
            <p className="mb-2">Trend reports contain aggregated, anonymised insights only. The following information is never included:</p>
            <BulletList items={[
              "Personal names, usernames, or email addresses",
              "Individual purchase amounts or transaction details",
              "Private commission content or briefs",
              "Any data that could identify a specific user",
            ]} />
            <p className="mt-2">Artists are anonymised by default in trend reports. Artists who wish to be named as a rising creator may opt in through Gallery Pro settings.</p>
          </Sub>
          <Sub title="15.3 How Your Data Contributes">
            Your aggregated, anonymised browse and engagement behaviour contributes to Gallery&apos;s trend data. Gallery uses industry-standard anonymisation practices before any data is used in trend reports.
          </Sub>
          <Sub title="15.4 Accuracy Disclaimer">
            Trend reports reflect Gallery platform activity and are not guaranteed to represent broader art market trends. Businesses purchase trend reports at their own risk. Gallery makes no warranty as to the accuracy or completeness of trend data.
          </Sub>
        </section>

        {/* 16 */}
        <section id="section-16">
          <SectionTitle n="16" title="Dispute Resolution" />
          <Sub title="16.1 Arbitration">
            Any legal dispute between you and Gallery will be resolved through binding arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules. Gallery covers all arbitration filing fees. Each party is responsible for their own legal representation costs unless the arbitrator awards otherwise.
          </Sub>
          <Sub title="16.2 Small Claims">
            Either party may bring a dispute valued under $10,000 in small claims court as an alternative to arbitration, at the claimant&apos;s option.
          </Sub>
          <Sub title="16.3 Class Action Waiver">
            You and Gallery both waive the right to participate in class action lawsuits or class-wide arbitration. All disputes must be brought individually.
          </Sub>
          <Sub title="16.4 Emergency Relief">
            Either party may seek emergency injunctive or other equitable relief from a court of competent jurisdiction without waiving their right to arbitration for the underlying dispute.
          </Sub>
          <Sub title="16.5 Procedures">
            <BulletList items={[
              "Governing law: State of Georgia, USA",
              "Arbitration conducted remotely by default; in person in Atlanta, Georgia if required",
              "Language: English",
              "Time limit: all claims must be filed within 1 year of the incident",
              "Opt out: you may opt out of arbitration within 30 days of account creation by notifying Gallery in writing",
            ]} />
          </Sub>
        </section>

        {/* 17 */}
        <section id="section-17">
          <SectionTitle n="17" title="Platform Availability" />
          <Sub title="17.1 Restoration Commitment">
            Gallery commits to restoring service within 11 days of any major platform outage. For every day beyond 11 that the platform remains unavailable, Gallery Pro subscribers will receive a corresponding extension of their subscription at no charge.
          </Sub>
          <Sub title="17.2 Planned Maintenance">
            Gallery will provide at least 48 hours&apos; advance notice of planned maintenance downtime via email and in-app notification.
          </Sub>
          <Sub title="17.3 Active Commissions During Outages">
            All active commission deadlines, delivery windows, and escrow timers are automatically paused for the duration of any platform outage and extended by the equivalent number of days.
          </Sub>
          <Sub title="17.4 Escrow During Outages">
            Escrow funds held on Gallery&apos;s behalf remain secure during outages. No escrow releases, transfers, or disbursements are processed during an active platform outage.
          </Sub>
          <Sub title="17.5 Data Integrity">
            Gallery maintains regular data backups and commits to the restoration of user data following any platform incident. Gallery will not knowingly allow user data loss to persist following an outage.
          </Sub>
          <Sub title="17.6 Status Page">
            Gallery maintains a public platform status page where users can check current platform health, active incidents, and maintenance windows at any time.
          </Sub>
        </section>

        {/* 18 */}
        <section id="section-18">
          <SectionTitle n="18" title="General" />
          <Sub title="18.1 Entire Agreement">
            These Terms of Service constitute the entire agreement between you and Gallery regarding the Platform and supersede all prior communications, representations, agreements, or understandings, whether written or oral.
          </Sub>
          <Sub title="18.2 Waiver">
            Failure by Gallery to enforce any provision of these Terms at any time shall not constitute a waiver of Gallery&apos;s right to enforce that provision or any other provision in the future.
          </Sub>
          <Sub title="18.3 Severability">
            If any provision of these Terms is found to be invalid, illegal, or unenforceable under applicable law, that provision will be modified to the minimum extent necessary to make it enforceable, or severed if modification is not possible. The remaining provisions will continue in full force and effect.
          </Sub>
          <Sub title="18.4 Legal Contact">
            <p className="mb-2">For legal notices, DMCA takedown requests, formal correspondence, and data privacy enquiries, contact:</p>
            <BulletList items={[
              "Legal: legal@shomronindustries.com",
              "General enquiries: hello@gallery.app",
            ]} />
          </Sub>
        </section>

      </div>

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

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-4 pb-2 border-b border-gray-100">
      <span className="text-blue-500 font-bold text-lg">{n}.</span>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    </div>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1.5">{title}</h3>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1 my-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
