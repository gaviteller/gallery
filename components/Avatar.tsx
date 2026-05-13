type Props = {
  src?: string | null
  name?: string | null
  username?: string | null
  size?: number   // px, default 36
  className?: string
}

export default function Avatar({ src, name, username, size = 36, className = "" }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? username ?? ""}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        style={{ width: size * 0.55, height: size * 0.55 }}
        stroke="#9ca3af"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  )
}
