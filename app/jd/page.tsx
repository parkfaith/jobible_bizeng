import Link from "next/link";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import JdClient from "./JdClient";

export const dynamic = "force-dynamic";

export default async function JdPage() {
  const rows = await db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.status, "active"))
    .orderBy(desc(jobPostings.id));

  const postings = rows.map((row) => {
    let summaryKo = "";
    try {
      summaryKo = (JSON.parse(row.summaryJson) as { summaryKo?: string }).summaryKo ?? "";
    } catch {
      // 손상된 summaryJson은 요약 없이 표시
    }
    return {
      id: row.id,
      company: row.company,
      position: row.position,
      summaryKo,
      createdAt: row.createdAt,
    };
  });

  return (
    <main className="min-h-full bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 pb-10">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/practice/interview"
          className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none"
        >
          ←
        </Link>
        <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-2xl shrink-0">
          📋
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">지원 공고</h1>
          <p className="text-slate-500 text-xs">공고를 등록하면 맞춤 면접을 볼 수 있습니다</p>
        </div>
      </div>

      <JdClient initialPostings={postings} />
    </main>
  );
}
