import Link from "next/link";
import { db } from "@/lib/db";
import { answerNotes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import NotesClient from "./NotesClient";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const notes = await db.select().from(answerNotes).orderBy(desc(answerNotes.updatedAt));

  return (
    <div className="app-shell flex flex-col max-w-md mx-auto bg-slate-950">
      {/* Scrollable content */}
      <div className="app-scroll px-4 pt-6 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link href="/" className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none">
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
            className="tap-target ml-auto bg-indigo-600 text-white text-xs px-3 rounded-lg font-medium flex items-center"
          >
            면접 시작
          </Link>
        </div>

        <NotesClient initialNotes={notes} />
      </div>

      {/* Bottom Nav — flex item (not fixed) to avoid iOS touch-event swallowing */}
      <nav className="bottom-nav shrink-0 bg-slate-900 border-t border-slate-800 flex justify-around pt-3">
        <Link href="/" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">🏠</span>
          <span className="text-xs">홈</span>
        </Link>
        <Link href="/practice/interview" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">🎙️</span>
          <span className="text-xs">면접</span>
        </Link>
        <Link href="/notes" className="tap-target flex flex-col items-center justify-center gap-1 text-indigo-400">
          <span className="text-xl">📓</span>
          <span className="text-xs">답변 노트</span>
        </Link>
        <Link href="/review" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">🗓️</span>
          <span className="text-xs">학습</span>
        </Link>
        <Link href="/stats" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">📊</span>
          <span className="text-xs">통계</span>
        </Link>
      </nav>
    </div>
  );
}
