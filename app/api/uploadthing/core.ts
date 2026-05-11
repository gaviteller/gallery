import { createUploadthing, type FileRouter } from "uploadthing/next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const f = createUploadthing()

export const ourFileRouter = {
  profileImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) throw new Error("Unauthorized")
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
