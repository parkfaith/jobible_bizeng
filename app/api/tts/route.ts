import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text || text.length > 500) {
    return NextResponse.json({ error: "invalid text" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "tts-1", voice: "nova", input: text, speed: 0.85 }),
    });

    if (!res.ok) {
      console.error("[tts] OpenAI error", res.status);
      return NextResponse.json({ error: "tts failed" }, { status: 500 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[tts]", err);
    return NextResponse.json({ error: "tts failed" }, { status: 500 });
  }
}
