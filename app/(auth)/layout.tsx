/** Wraps auth pages. Redesigned pages (.gx) ignore this frame via app/redesign/shell.css. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-route-frame" style={{ flex: "1 0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: "var(--bg)" }}>
      <div className="auth-route-frame-inner" style={{ width: "100%", maxWidth: 400 }}>{children}</div>
    </div>
  )
}
