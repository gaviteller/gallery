import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { scanComment } from '../lib/ai-scan'

const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)\s*=\s*"?([^"#\n]+)"?\s*$/)
  if (m) process.env[m[1]] = m[2].trim()
}

async function main() {
  console.log('OPENROUTER_API_KEY set:', !!process.env.OPENROUTER_API_KEY)

  const p = new PrismaClient()

  const user = await p.user.findFirst({ where: { username: 'gavi' }, select: { id: true } })
  if (!user) { console.error('user not found'); process.exit(1) }

  const post = await p.post.findFirst({ where: { userId: user.id }, select: { id: true } })
  if (!post) { console.error('post not found'); process.exit(1) }

  const comment = await p.comment.create({
    data: {
      userId: user.id,
      postId: post.id,
      text: 'I will dox you and post your home address online. Watch your back, I know where you live.',
    }
  })
  console.log('Created comment:', comment.id, 'on post:', post.id)
  console.log('Firing scanComment...')

  await scanComment(p, comment.id)

  const result = await p.comment.findUnique({
    where: { id: comment.id },
    select: { hidden: true, hiddenReason: true },
  })
  console.log('Result:', JSON.stringify(result, null, 2))

  await p.comment.delete({ where: { id: comment.id } })
  console.log('Cleaned up test comment')
  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
