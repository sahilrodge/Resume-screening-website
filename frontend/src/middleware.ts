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

  // Proxy + auth API must pass through without session redirects
  if (
    pathname.startsWith("/api/v1") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next()
  }

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

  if (!role) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    const redirect = NextResponse.redirect(url)
    redirect.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    )
    return redirect
  }

  if (!canAccessPath(role, pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = homeForRole(role)
    const redirect = NextResponse.redirect(url)
    redirect.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    )
    return redirect
  }

  const response = NextResponse.next()
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  )
  response.headers.set("Pragma", "no-cache")
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
