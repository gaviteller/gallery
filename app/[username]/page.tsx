import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const statusColors = {
  OPEN: "bg-green-100 text-green-700",
  LIMITED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

const statusLabels = {
  OPEN: "Open for commissions",
  LIMITED: "Limited commissions",
  CLOSED: "Closed for commissions",
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const profileUser = await prisma.user.findUnique({
    where: { username },
  })

  if (!profileUser) notFound()

  const session = await getServerSession(authOptions)
  const isOwn = session?.user?.id === profileUser.id

  const initials = (profileUser.name ?? profileUser.username ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold flex-shrink-0">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{profileUser.name ?? profileUser.username}</h1>
            {isOwn && (
              <Link
                href="/settings/account"
                className="text-sm px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Edit profile
              </Link>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">@{profileUser.username}</p>

          {profileUser.bio && (
            <p className="text-gray-700 text-sm mt-3">{profileUser.bio}</p>
          )}

          <div className="mt-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                statusColors[profileUser.commissionStatus]
              }`}
            >
              {statusLabels[profileUser.commissionStatus]}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {["Posts", "Shop", "Commissions", "About"].map((tab) => (
            <button
              key={tab}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === "Posts"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Posts tab — empty state */}
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-3">🖼️</div>
        <p className="font-medium text-gray-500">No posts yet</p>
        {isOwn && (
          <p className="text-sm mt-1">Share your first piece of art</p>
        )}
      </div>
    </div>
  )
}
