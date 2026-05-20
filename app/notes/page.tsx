import Link from "next/link";
import { db } from "@/lib/db";
import { answerNotes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import NotesClient from "./NotesClient";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const notes = await db.select().from(answerNotes).orderBy(desc(answerNotes.updatedAt));

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="text-slate-400 text-2xl leading-none">
          ←
        </Link>
        <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-2xl shrink-0">
          📓
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">답변 노트</h1>
          <p className="text-slate-500 text-xs">총 {notes.length}개</p>
        </div>
        <Link
          href="/practice/interview"
          className="ml-auto bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
        >
          면접 시작
        </Link>
      </div>

      <NotesClient initialNotes={notes} />

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around py-3">
        <Link href="/" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="text-xl">🏠</span>
          <span className="text-xs">홈</span>
        </Link>
        <Link href="/practice/interview" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="text-xl">🎙️</span>
          <span className="text-xs">면접</span>
        </Link>
        <Link href="/notes" className="flex flex-col items-center gap-1 text-indigo-400">
          <span className="text-xl">📓</span>
          <span className="text-xs">답변 노트</span>
        </Link>
        <Link href="/review" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="text-xl">🗓️</span>
          <span className="text-xs">복습</span>
        </Link>
        <Link href="/stats" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="text-xl">📊</span>
          <span className="text-xs">통계</span>
        </Link>
      </nav>
    </main>
  );
}
