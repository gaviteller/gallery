"use client"

import Link from "next/link"

export default function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (/^@[a-zA-Z0-9_]+$/.test(part)) {
          return (
            <Link key={i} href={`/@${part.slice(1)}`}
              className="text-blue-500 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}>
              {part}
            </Link>
          )
        }
        if (/^#[a-zA-Z0-9_]+$/.test(part)) {
          return (
            <Link key={i} href={`/hashtag/${part.slice(1).toLowerCase()}`}
              className="text-blue-500 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}>
              {part}
            </Link>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
