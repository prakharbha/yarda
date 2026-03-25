import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAuthPage = pathname === "/login" || pathname === "/signup"
  const isApiAuth = pathname.startsWith("/api/auth")

  if (isApiAuth || pathname === "/api/health") return NextResponse.next()

  const session = await auth()
  const isLoggedIn = !!session?.user

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
