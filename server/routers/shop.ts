import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { checkNotBanned } from "@/server/lib/ban"
import { sendShopInquiryEmail } from "@/lib/email"

export const shopRouter = router({
  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.prisma.shopItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    }),

  create: protectedProcedure
    .input(z.object({
      image: z.string().min(1),
      title: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      price: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      return ctx.prisma.shopItem.create({
        data: {
          userId: ctx.session.user.id,
          image: input.image,
          title: input.title,
          description: input.description ?? null,
          price: input.price,
        },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.findUnique({ where: { id: input.id } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.shopItem.delete({ where: { id: input.id } })
    }),

  sendInquiry: protectedProcedure
    .input(z.object({
      itemId: z.string(),
      message: z.string().min(1).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.findUnique({
        where: { id: input.itemId },
        include: { user: { select: { id: true, email: true, username: true } } },
      })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot inquire about your own item" })
      }
      const buyer = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { username: true },
      })
      if (item.user.email) {
        await sendShopInquiryEmail(item.user.email, {
          artistUsername: item.user.username ?? "there",
          buyerUsername: buyer?.username ?? "Someone",
          itemTitle: item.title,
          message: input.message,
        })
      }
      return { success: true }
    }),
})
