export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="h-8 w-64 animate-pulse rounded bg-surface2" />
      <div className="h-16 animate-pulse rounded-lg bg-surface" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-surface" />
    </div>
  );
}
