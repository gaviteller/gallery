import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// The old cookie name used before we renamed it. Browsers that signed in
// before the fix will be sending this giant base64-image-stuffed cookie
// with every request, causing Vercel's 494 REQUEST_HEADER_TOO_LARGE error.
// This middleware immediately expires it so the browser stops sending it.
const OLD_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
]

export function middleware(request: NextRequest) {
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

  // If we had to clear an old cookie, redirect so the browser sends the
  // cleaned-up request immediately rather than processing this one with
  // the bloated headers still in memory.
  if (cleared) {
    return NextResponse.redirect(request.url, { headers: response.headers })
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
