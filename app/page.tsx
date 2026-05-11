import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect("/signin")
  if (!session.user.onboardingComplete || !session.user.username) redirect("/onboarding")

  redirect(`/@${session.user.username}`)
}
