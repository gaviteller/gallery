import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { token, email } = await req.json()
    if (!token || !email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const record = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: email, token } },
    })

    if (!record) {
      return NextResponse.json({ error: "Invalid verification link." }, { status: 400 })
    }

    if (record.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
      })
      return NextResponse.json({ error: "This link has expired. Please sign up again." }, { status: 400 })
    }

    await Promise.all([
      prisma.user.update({ where: { email }, data: { emailVerified: new Date() } }),
      prisma.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
