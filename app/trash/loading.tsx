export default function TrashLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div>
        <div className="h-6 w-20 rounded-xl skeleton mb-2" />
        <div className="h-4 w-72 rounded-lg skeleton" />
      </div>
      <div className="h-64 rounded-2xl skeleton" />
    </div>
  )
}
