
function Shimmer({ className }: { className: string }) {
  return <div className={`bg-muted rounded-lg animate-pulse ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 border-b border-border h-[96px]" />
      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        <div className="space-y-2">
          <Shimmer className="h-7 w-44" />
          <Shimmer className="h-4 w-36" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-card border border-border px-4 py-4 h-[92px] animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-card border border-border animate-pulse" />
      ))}
    </div>
  );
}

export function PrizeCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4 animate-pulse">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Shimmer className="h-5 w-40" />
              <Shimmer className="h-3.5 w-28" />
            </div>
            <Shimmer className="h-6 w-20 rounded-full" />
          </div>
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
