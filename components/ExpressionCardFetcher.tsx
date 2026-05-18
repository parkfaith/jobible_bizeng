"use client";

import { useEffect, useState } from "react";
import ExpressionCard, { type ExpressionData } from "./ExpressionCard";

export default function ExpressionCardFetcher() {
  const [data, setData] = useState<ExpressionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/expressions/daily")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
        <p className="text-slate-500 text-sm">오늘의 표현 불러오는 중...</p>
      </div>
    );
  }

  if (!data) return null;

  return <ExpressionCard data={data} />;
}
