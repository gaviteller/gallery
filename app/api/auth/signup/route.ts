import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normalizeEmail } from "@/lib/normalizeEmail"

export async function POST(req: Request) {
  try {
    const { name, email, username, password } = await req.json()

    if (!name || !email || !username || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 3 || username.length > 30) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 })
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } })
    if (existingUsername) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const newUser = await prisma.user.create({
      data: { name, email, username, password: hashedPassword },
    })

    // Ban evasion detection: normalize email and check against existing banned accounts
    const normalized = normalizeEmail(email)
    await prisma.user.update({
      where: { id: newUser.id },
      data: { normalizedEmail: normalized },
    })
    const bannedMatches = await prisma.user.findMany({
      where: {
        normalizedEmail: normalized,
        id: { not: newUser.id },
        bannedUntil: { not: null },
      },
      select: { id: true, bannedUntil: true },
    })
    const hasBannedMatch = bannedMatches.some(
      u => u.bannedUntil && u.bannedUntil > new Date()
    )
    if (hasBannedMatch) {
      await prisma.user.update({
        where: { id: newUser.id },
        data: { banEvasionFlag: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
