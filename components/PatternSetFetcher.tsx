"use client";

import { useEffect, useState } from "react";
import type { DailyPatternSet } from "@/lib/pattern-set";
import PatternSetCard from "./PatternSetCard";

export default function PatternSetFetcher() {
  const [data, setData] = useState<DailyPatternSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patterns/daily")
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError("오늘의 패턴을 만들지 못했습니다.");
        } else {
          setData(body);
        }
      })
      .catch(() => setError("오늘의 패턴을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 py-1">
          <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
          <p className="text-slate-500 text-sm">오늘의 답변 패턴 준비 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4">
        <p className="text-slate-300 text-sm font-medium">오늘의 답변 패턴</p>
        <p className="text-slate-500 text-xs mt-1">{error || "표시할 패턴이 없습니다."}</p>
      </div>
    );
  }

  return <PatternSetCard data={data} />;
}
