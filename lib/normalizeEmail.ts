export function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@")
  const normalizedLocal = local.split("+")[0].replace(/\./g, "")
  return `${normalizedLocal}@${domain}`
}
