import { NextResponse, type NextRequest } from "next/server"

import {
  SESSION_COOKIE,
  canAccessPath,
  homeForRole,
  isPublicPath,
  verifySessionCookie,
} from "@/lib/auth-roles"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const secret = process.env.AUTH_SECRET
  const session = await verifySessionCookie(
    request.cookies.get(SESSION_COOKIE)?.value,
    secret
  )
  const role = session?.role

  if (role && isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = homeForRole(role)
    return NextResponse.redirect(url)
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = role ? homeForRole(role) : "/login"
    return NextResponse.redirect(url)
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Allow session API routes without an existing cookie
  if (pathname.startsWith("/api/auth/session")) {
    return NextResponse.next()
  }

  if (!role) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (!canAccessPath(role, pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = homeForRole(role)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
