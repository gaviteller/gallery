/**
 * DATABASE CLIENT — the single shared connection to PostgreSQL (Neon).
 *
 * Import `prisma` from here; never create a new PrismaClient elsewhere.
 * In development, the client is stored on `globalThis` so hot-reloading
 * doesn't open a new database connection on every file save.
 * In development every SQL query is also printed to the server log.
 */
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
