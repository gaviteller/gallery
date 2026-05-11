import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect("/signin")
  if (!session.user.onboardingComplete) redirect("/onboarding")

  // Placeholder until feed is built
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Gallery</h1>
        <p className="text-gray-500 mt-2">Signed in as {session.user.email}</p>
        <a
          href="/settings/account"
          className="mt-4 inline-block text-blue-600 hover:underline text-sm"
        >
          Account Settings →
        </a>
      </div>
    </div>
  )
}
