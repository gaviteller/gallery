/**
 * Reduces an email to a canonical form for ban-evasion checks, so variants of
 * the same inbox are treated as one person:
 *   "John.Smith+art@Gmail.com" → "johnsmith@gmail.com"
 * (lowercase, drop "+anything", drop dots before the @)
 */
export function normalizeEmail(email: string): string {
  const [mailboxName, domain] = email.toLowerCase().split("@")
  const canonicalMailbox = mailboxName.split("+")[0].replace(/\./g, "")
  return `${canonicalMailbox}@${domain}`
}
