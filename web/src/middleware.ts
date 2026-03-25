import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAuthPage = pathname === "/login" || pathname === "/signup"
  const isApiAuth = pathname.startsWith("/api/auth")

  // Allow static files, auth pages, auth API
  if (isApiAuth) return NextResponse.next()

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  })

  const isLoggedIn = !!token

  if (isAuthPage) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/", req.url))
    return NextResponse.next()
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
