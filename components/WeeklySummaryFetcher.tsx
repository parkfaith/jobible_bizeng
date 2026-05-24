"use client";

import { useEffect, useState } from "react";
import type { WeeklySummarySet } from "@/lib/pattern-set";
import WeeklySummaryCard from "./WeeklySummaryCard";

export default function WeeklySummaryFetcher() {
  const [data, setData] = useState<WeeklySummarySet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patterns/weekly", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.weekdayHint ? "" : "주간 요약을 만들지 못했습니다.");
        } else {
          setData(body);
        }
      })
      .catch(() => setError("주간 요약을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 py-1">
          <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
          <p className="text-slate-500 text-sm">이번 주 면접 요약 준비 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4">
        <p className="text-slate-300 text-sm font-medium">이번 주 면접 답변 요약</p>
        <p className="text-slate-500 text-xs mt-1">
          {error || "이번 주 패턴이 쌓이면 주말 요약이 자동으로 생성됩니다."}
        </p>
      </div>
    );
  }

  return <WeeklySummaryCard data={data} />;
}
