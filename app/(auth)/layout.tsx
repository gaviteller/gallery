export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#0D0D0F" }}>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
