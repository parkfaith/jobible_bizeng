import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json();

  const appPassword = process.env.APP_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!appPassword || !sessionSecret) {
    return NextResponse.json(
      { error: "서버 인증 설정이 누락되었습니다. .env.local을 확인하세요." },
      { status: 500 }
    );
  }

  if (password !== appPassword) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("jb_session", sessionSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: "/",
  });

  return response;
}
