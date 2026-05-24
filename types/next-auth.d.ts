import { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string | null
      sellingEnabled: boolean
      onboardingComplete: boolean
      bannedUntil: string | null  // ISO string or null
    } & DefaultSession["user"]
  }

  interface User {
    username: string | null
    sellingEnabled: boolean
    onboardingComplete: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string | null
    sellingEnabled: boolean
    onboardingComplete: boolean
    bannedUntil: string | null  // ISO string or null
  }
}
