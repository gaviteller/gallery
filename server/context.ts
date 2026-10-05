/**
 * REQUEST CONTEXT — what every API function receives as `ctx`.
 *
 * Built once per incoming request:
 *  - `ctx.session` → who is logged in (null if nobody)
 *  - `ctx.prisma`  → the database client
 */
import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type Context = {
  session: Session | null
  prisma: typeof prisma
}

/** Looks up the logged-in user's session and bundles it with the database client. */
export async function createContext(): Promise<Context> {
  const session = await getServerSession(authOptions)
  return { session, prisma }
}
