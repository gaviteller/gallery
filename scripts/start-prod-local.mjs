// Runs the production build on http://localhost:3002 for speed testing on this computer.
// Uses .env.local (passed with --env-file) so it never picks up the Vercel values pulled into .env.production.local.
process.env.NEXTAUTH_URL = "http://localhost:3002"
process.argv = [process.argv[0], "next", "start", "-p", "3002"]
await import("../node_modules/next/dist/bin/next")
