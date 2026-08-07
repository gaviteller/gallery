import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { scanPost } from '../lib/ai-scan'

// Load .env.local
const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)\s*=\s*"?([^"#\n]+)"?\s*$/)
  if (m) process.env[m[1]] = m[2].trim()
}

async function main() {
  console.log('OPENROUTER_API_KEY set:', !!process.env.OPENROUTER_API_KEY)

  const prisma = new PrismaClient({ log: [] })

  const post = await prisma.post.findFirst({ select: { id: true, userId: true, image: true } })
  if (!post) { console.error('No posts found'); process.exit(1) }

  console.log('Post ID:', post.id)
  console.log('Firing scan...')

  await scanPost(prisma, post.id, post.userId, post.image)

  const updated = await prisma.post.findUnique({
    where: { id: post.id },
    select: { aiVerdict: true, aiScores: true, status: true },
  })
  const log = await prisma.aIScanLog.findFirst({
    where: { contentId: post.id },
    orderBy: { createdAt: 'desc' },
  })

  console.log('--- Result ---')
  console.log('aiVerdict:', updated?.aiVerdict)
  console.log('status:', updated?.status)
  console.log('aiScores:', JSON.stringify(updated?.aiScores))
  console.log('log action:', log?.action)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
