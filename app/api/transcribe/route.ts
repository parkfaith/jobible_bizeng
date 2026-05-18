import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get("audio") as Blob | null;

  if (!audio) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  }

  const whisperForm = new FormData();
  // Whisper accepts webm, mp4, wav — browser MediaRecorder produces webm or mp4
  const ext = audio.type.includes("mp4") ? "mp4" : "webm";
  whisperForm.append("file", audio, `recording.${ext}`);
  whisperForm.append("model", "whisper-1");
  whisperForm.append("language", "en");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: whisperForm,
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json({ error }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ transcript: data.text ?? "" });
}
