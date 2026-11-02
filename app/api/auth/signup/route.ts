/**
 * POST /api/auth/signup — creates an email + password account.
 * (The signup page calls this, then signs the user in with NextAuth.)
 *
 * Rules: all fields required · password ≥ 8 chars · username 3–30 letters,
 * numbers or underscores · age 13+ · email and username not already used
 * (compared ignoring upper/lower case, since logins and profile URLs ignore case).
 * New accounts get the ban-evasion check and a welcome email.
 */
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { runBanEvasionCheck } from "@/lib/auth"
import { isAtLeast13 } from "@/lib/age"
import { sendWelcomeEmail } from "@/lib/email"

const MIN_PASSWORD_LENGTH = 8
const PASSWORD_HASH_ROUNDS = 12

const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(1),
  dateOfBirth: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const parsed = signupSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }
    const { name, username, password, dateOfBirth } = parsed.data
    const email = parsed.data.email.toLowerCase()

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 3 || username.length > 30) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 })
    }
    if (!isAtLeast13(dateOfBirth)) {
      return NextResponse.json({ error: "You must be at least 13 years old to create an account." }, { status: 400 })
    }

    const [emailOwner, usernameOwner] = await Promise.all([
      prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
      prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } }, select: { id: true } }),
    ])
    if (emailOwner) return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    if (usernameOwner) return NextResponse.json({ error: "Username already taken" }, { status: 400 })

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS),
        dateOfBirth: new Date(dateOfBirth),
      },
      select: { id: true, email: true, username: true },
    })

    if (newUser.email) {
      await runBanEvasionCheck(newUser.id, newUser.email)
      await sendWelcomeEmail(newUser.email, { username: newUser.username! })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
