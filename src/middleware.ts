import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Check role-based access for specific routes
    if (path.startsWith("/dashboard/reports")) {
      const allowedRoles = ["FINANCE_TEAM", "FINANCE_CONTROLLER", "DIRECTOR", "MD", "ADMIN"]
      if (!token?.role || !allowedRoles.includes(token.role as string)) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
    }

    if (path.startsWith("/dashboard/users") || path.startsWith("/dashboard/settings")) {
      if (token?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*"],
}
