/**
 * SkeletonCard — shimmer placeholder while calls load.
 * Uses the .skeleton CSS class from globals.css (theme-aware shimmer).
 */
export function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="skeleton h-3 w-20" />
      </div>

      {/* Body */}
      <div className="skeleton h-4 w-full mb-2" />
      <div className="skeleton h-4 w-3/4 mb-4" />

      {/* Talk ratio bar */}
      <div
        className="pt-4"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex justify-between mb-2">
          <div className="skeleton h-3 w-12" />
          <div className="skeleton h-3 w-12" />
        </div>
        <div className="skeleton h-2 w-full rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
