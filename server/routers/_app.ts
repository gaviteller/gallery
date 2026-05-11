import { router } from "@/lib/trpc"
import { userRouter } from "./user"
import { postRouter } from "./post"
import { followRouter } from "./follow"
import { notificationRouter } from "./notification"
import { interactionRouter } from "./interaction"

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  follow: followRouter,
  notification: notificationRouter,
  interaction: interactionRouter,
})

export type AppRouter = typeof appRouter
