"use client"

import Link from "next/link"

export default function MentionText({ text }: { text: string }) {
  // Split on @mention patterns, keeping the delimiters
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (/^@[a-zA-Z0-9_]+$/.test(part)) {
          const username = part.slice(1)
          return (
            <Link
              key={i}
              href={`/${username}`}
              className="text-blue-500 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
