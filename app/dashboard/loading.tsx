export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-44 rounded-xl skeleton mb-2" />
          <div className="h-4 w-56 rounded-lg skeleton" />
        </div>
        <div className="h-10 w-28 rounded-xl skeleton" />
      </div>
      {/* Search + filters */}
      <div className="h-11 w-full rounded-xl skeleton" />
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-xl skeleton" />
        ))}
      </div>
      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl skeleton" />
        ))}
      </div>
      {/* Cards */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-28 rounded-2xl skeleton" />
      ))}
    </div>
  )
}
