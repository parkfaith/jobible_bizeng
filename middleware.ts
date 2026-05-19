import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 페이지와 auth API는 통과
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("jb_session");
  const sessionSecret = process.env.SESSION_SECRET ?? "";

  if (!sessionSecret || sessionCookie?.value !== sessionSecret) {
    // API 요청은 401 반환
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // 페이지는 로그인으로 리다이렉트
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Next.js 내부, 정적 파일, PWA 에셋 제외
    "/((?!_next/static|_next/image|favicon.ico|icons|apple-touch-icon.png|manifest.json|sw.js|workbox-).*)",
  ],
};
