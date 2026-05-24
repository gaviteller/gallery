import { type NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import EmailProvider from "next-auth/providers/email"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

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
    async jwt({ token, user, trigger }) {
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id as string } })
        if (fresh) {
          token.username = fresh.username
          token.sellingEnabled = fresh.sellingEnabled
          token.onboardingComplete = fresh.onboardingComplete
          token.bannedUntil = fresh.bannedUntil?.toISOString() ?? null
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
