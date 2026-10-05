/**
 * ROOT API ROUTER — the table of contents for the whole backend.
 *
 * Every server function the website can call lives in one of these routers.
 * The key on the left is the name the frontend uses, e.g. `trpc.post.getFeed`
 * runs `getFeed` inside ./post.ts. To find where any `trpc.X.Y` call is handled,
 * open ./X.ts and search for `Y:`.
 *
 * NOTE: these keys are part of the public API — renaming one breaks every page that calls it.
 */
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
import { dmRouter } from "./dm"
import { pushRouter } from "./push"
import { storyRouter } from "./story"
import { dmcaRouter } from "./dmca"
import { authRouter } from "./auth"
import { blockRouter } from "./block"
import { searchRouter } from "./search"
import { discoveryRouter } from "./discovery"

export const appRouter = router({
  user: userRouter,                           // profiles, settings, onboarding, username checks
  post: postRouter,                           // creating posts, home feed, profile posts
  follow: followRouter,                       // follow / unfollow, follower lists
  notification: notificationRouter,           // in-app notification bell
  interaction: interactionRouter,             // likes, comments, reports
  hashtag: hashtagRouter,                     // hashtag pages
  shop: shopRouter,                           // shop listings, cart checkout, orders
  commission: commissionRouter,               // commission requests and their full lifecycle
  commissionMessage: commissionMessageRouter, // messages inside a commission thread
  dm: dmRouter,                               // direct messages (social DMs)
  push: pushRouter,                           // browser push-notification subscriptions
  story: storyRouter,                         // 24-hour stories
  dmca: dmcaRouter,                           // copyright takedowns and counter-notices
  auth: authRouter,                           // signup, password reset
  block: blockRouter,                         // blocking users
  search: searchRouter,                       // the /search page results
  discovery: discoveryRouter,                 // Rising Stars, Spotlight, For You, trending tags
})

/** Type of the whole API — the frontend imports this so every call is type-checked. */
export type AppRouter = typeof appRouter
