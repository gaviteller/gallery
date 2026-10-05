/**
 * API BUILDING BLOCKS (tRPC).
 *
 * Every server function is built from one of these "procedures", which decide
 * WHO is allowed to call it:
 *
 *   publicProcedure    → anyone, even logged out
 *   protectedProcedure → must be logged in (ctx.session.user is guaranteed)
 *   modProcedure       → must be a moderator or admin
 *   adminProcedure     → must be an admin
 *
 * `superjson` lets Dates and other rich types travel between server and browser intact.
 */
import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { type Context } from "@/server/context"

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

/** Rejects the call with UNAUTHORIZED unless someone is logged in. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  })
})

/** Logged in AND flagged as moderator or admin in the database. */
export const modProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { isAdmin: true, isModerator: true },
  })
  if (!user?.isAdmin && !user?.isModerator) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return next()
})

/** Logged in AND flagged as admin in the database. */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return next()
})
