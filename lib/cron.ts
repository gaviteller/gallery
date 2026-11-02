/**
 * SCHEDULED JOB AUTH — every /api/cron/* route must call `isAuthorizedCronRequest`.
 *
 * Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" (schedules are in vercel.json).
 * If CRON_SECRET isn't configured we refuse every request: otherwise the expected
 * header would be "Bearer undefined", which anyone could send.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return request.headers.get("authorization") === `Bearer ${cronSecret}`
}
