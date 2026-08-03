export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4">
      <div className="flex items-center space-x-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent"></div>
        <span className="text-sm font-medium text-zinc-600">Loading WSNexa...</span>
      </div>
    </div>
  );
}
