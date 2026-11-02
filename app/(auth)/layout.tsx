export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: "1 0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>{children}</div>
    </div>
  )
}
