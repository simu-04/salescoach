export default function CallDetailLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-20 rounded skeleton" />
        <div className="h-4 w-3 rounded skeleton" />
        <div className="h-4 w-32 rounded skeleton" />
      </div>
      {/* Header card */}
      <div className="h-28 rounded-2xl skeleton" />
      {/* Top recommendation */}
      <div className="h-32 rounded-2xl skeleton" />
      {/* Summary */}
      <div className="h-36 rounded-2xl skeleton" />
      {/* Talk ratio */}
      <div className="h-24 rounded-2xl skeleton" />
      {/* Risk + objections */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 rounded-2xl skeleton" />
        <div className="h-48 rounded-2xl skeleton" />
      </div>
    </div>
  )
}
