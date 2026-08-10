export default function ReportsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-zinc-800 rounded-lg" />
          <div className="h-4 w-72 bg-zinc-800/60 rounded" />
        </div>
        <div className="h-10 w-28 bg-zinc-800 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
            <div className="h-4 w-28 bg-zinc-800 rounded" />
            <div className="h-8 w-36 bg-zinc-800 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
        <div className="h-5 w-48 bg-zinc-800 rounded" />
        <div className="h-72 bg-zinc-950 rounded-xl border border-zinc-800/50" />
      </div>
    </div>
  );
}
