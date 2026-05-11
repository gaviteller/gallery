import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// The old cookie name used before we renamed it. Browsers that signed in
// before the fix will be sending this giant base64-image-stuffed cookie
// with every request, causing Vercel's 494 REQUEST_HEADER_TOO_LARGE error.
// This proxy clears it immediately so the browser stops sending it.
const OLD_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
]

export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  let cleared = false
  for (const name of OLD_COOKIE_NAMES) {
    if (request.cookies.has(name)) {
      response.cookies.set(name, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      })
      cleared = true
    }
  }

  // Redirect so the browser sends a clean request without the old cookie
  if (cleared) {
    return NextResponse.redirect(request.url, { headers: response.headers })
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
