import { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string | null
      sellingEnabled: boolean
      onboardingComplete: boolean
    } & DefaultSession["user"]
  }

  interface User {
    username: string | null
    sellingEnabled: boolean
    onboardingComplete: boolean
  }
}
