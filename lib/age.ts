/**
 * Returns true if the given ISO date string (YYYY-MM-DD) represents
 * a person who is at least 13 years old today.
 */
export function isAtLeast13(dateStr: string): boolean {
  const dob = new Date(dateStr)
  if (isNaN(dob.getTime())) return false
  const threshold = new Date()
  threshold.setFullYear(threshold.getFullYear() - 13)
  return dob <= threshold
}
