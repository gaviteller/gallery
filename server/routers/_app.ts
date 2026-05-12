import { router } from "@/lib/trpc"
import { userRouter } from "./user"
import { postRouter } from "./post"
import { followRouter } from "./follow"
import { notificationRouter } from "./notification"
import { interactionRouter } from "./interaction"
import { hashtagRouter } from "./hashtag"
import { shopRouter } from "./shop"
import { commissionRouter } from "./commission"
import { commissionMessageRouter } from "./commissionMessage"

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  follow: followRouter,
  notification: notificationRouter,
  interaction: interactionRouter,
  hashtag: hashtagRouter,
  shop: shopRouter,
  commission: commissionRouter,
  commissionMessage: commissionMessageRouter,
})

export type AppRouter = typeof appRouter
