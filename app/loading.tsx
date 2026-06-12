export default function Loading() {
  return (
    <main className="min-h-full bg-slate-950 flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-12 w-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-slate-300">화면을 준비하는 중...</p>
      </div>
    </main>
  );
}
