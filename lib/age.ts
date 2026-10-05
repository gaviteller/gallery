/**
 * Returns true if the given ISO date string (YYYY-MM-DD) represents
 * a person who is at least 13 years old today.
 */
export function isAtLeast13(dateStr: string): boolean {
  const dateOfBirth = new Date(dateStr)
  if (isNaN(dateOfBirth.getTime())) return false
  const latestAllowedBirthDate = new Date()
  latestAllowedBirthDate.setFullYear(latestAllowedBirthDate.getFullYear() - 13)
  return dateOfBirth <= latestAllowedBirthDate
}
