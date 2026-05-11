import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type Context = {
  session: Session | null
  prisma: typeof prisma
}

export async function createContext(): Promise<Context> {
  const session = await getServerSession(authOptions)
  return { session, prisma }
}
