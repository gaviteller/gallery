/**
 * LOGIN / SESSION SETUP (NextAuth).
 *
 * Decides how people can sign in and what's stored in their login cookie:
 *  - Email + password (always on)
 *  - Google, Apple, magic-link email → only switched on if their keys are in .env
 *
 * The session lives in a small signed cookie (JWT). We deliberately keep it tiny —
 * only id, username and a few flags — and load everything else with `trpc.user.me`.
 */
import { type NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import EmailProvider from "next-auth/providers/email"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { normalizeEmail } from "./normalizeEmail"

/**
 * Ban-evasion check for a newly created account.
 * Saves the account's canonical email, then flags the account (`banEvasionFlag`)
 * if another currently-banned account uses the same inbox. Moderators see the flag.
 */
export async function runBanEvasionCheck(userId: string, email: string) {
  const canonicalEmail = normalizeEmail(email)
  await prisma.user.update({
    where: { id: userId },
    data: { normalizedEmail: canonicalEmail },
  })
  const bannedAccountsWithSameEmail = await prisma.user.findMany({
    where: {
      normalizedEmail: canonicalEmail,
      id: { not: userId },
      bannedUntil: { not: null },
    },
    select: { id: true, bannedUntil: true },
  })
  const hasBannedMatch = bannedAccountsWithSameEmail.some(
    account => account.bannedUntil && account.bannedUntil > new Date()
  )
  if (hasBannedMatch) {
    await prisma.user.update({
      where: { id: userId },
      data: { banEvasionFlag: true },
    })
  }
}

/**
 * The standard NextAuth↔database adapter, plus one extra step: every account
 * created through Google/Apple/email-link also gets the ban-evasion check.
 * (Password signups run the same check in server/routers/auth.ts.)
 */
function buildAdapter() {
  const defaultAdapter = PrismaAdapter(prisma)
  return {
    ...defaultAdapter,
    async createUser(data: Parameters<NonNullable<typeof defaultAdapter.createUser>>[0]) {
      const newUser = await defaultAdapter.createUser!(data)
      if (newUser.email) {
        await runBanEvasionCheck(newUser.id, newUser.email)
      }
      return newUser
    },
  }
}

export const authOptions: NextAuthOptions = {
  adapter: buildAdapter(),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findFirst({
          where: { email: { equals: credentials.email, mode: "insensitive" } },
        })

        if (!user || !user.password) return null

        // Passwords are stored hashed (bcrypt); compare against the hash, never plain text.
        const passwordMatches = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatches) return null

        // Keep the JWT small — only store what's needed for routing/auth guards.
        // image/name/email are NOT stored here because base64 profile photos
        // will blow past Vercel's 8 KB header limit (494 error).
        // Use trpc.user.me to fetch full profile data instead.
        return {
          id: user.id,
          username: user.username,
          sellingEnabled: user.sellingEnabled,
          onboardingComplete: user.onboardingComplete,
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [AppleProvider({ clientId: process.env.APPLE_ID, clientSecret: process.env.APPLE_SECRET })]
      : []),
    ...(process.env.EMAIL_SERVER
      ? [EmailProvider({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM ?? "Gallery <noreply@gallery.app>" })]
      : []),
  ],
  callbacks: {
    /**
     * Builds the contents of the login cookie.
     * Runs at sign-in (`user` is set) and whenever the page calls `update()`
     * (`trigger === "update"`, e.g. after changing username or finishing onboarding).
     */
    async jwt({ token, user, trigger }) {
      if (trigger === "update" && token.id) {
        const latestUser = await prisma.user.findUnique({ where: { id: token.id as string } })
        if (latestUser) {
          token.username = latestUser.username
          token.sellingEnabled = latestUser.sellingEnabled
          token.onboardingComplete = latestUser.onboardingComplete
          token.bannedUntil = latestUser.bannedUntil?.toISOString() ?? null
        }
      }
      if (user) {
        token.id = user.id
        token.username = (user as any).username ?? null
        token.sellingEnabled = (user as any).sellingEnabled ?? false
        token.onboardingComplete = (user as any).onboardingComplete ?? false
        // Fetch ban status at sign-in time
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub! },
          select: { bannedUntil: true },
        })
        token.bannedUntil = dbUser?.bannedUntil?.toISOString() ?? null
      }
      // Strip fields NextAuth adds by default that we don't need in the cookie
      delete token.name
      delete token.email
      delete token.picture
      return token
    },
    /** Copies cookie fields onto `session.user`, which pages read via useSession(). */
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string | null
        session.user.sellingEnabled = token.sellingEnabled as boolean
        session.user.onboardingComplete = token.onboardingComplete as boolean
        session.user.bannedUntil = (token.bannedUntil as string | null) ?? null
      }
      return session
    },
  },
  cookies: {
    sessionToken: {
      name: "gallery.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/signin",
    newUser: "/onboarding",
  },
}
