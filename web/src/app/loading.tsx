export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-pulse-blue-500 flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  );
}