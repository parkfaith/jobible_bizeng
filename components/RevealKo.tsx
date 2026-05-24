"use client";

import { useState } from "react";

export default function RevealKo({ text }: { text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-1.5">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="text-slate-600 text-xs hover:text-slate-400 transition-colors"
      >
        {open ? "접기 ▴" : "해석 보기 ▾"}
      </button>
      {open && (
        <p className="text-slate-400 text-xs leading-relaxed mt-1">{text}</p>
      )}
    </div>
  );
}
