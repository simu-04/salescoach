export default function UploadLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 animate-pulse">
      <div className="text-center mb-10">
        <div className="h-8 w-64 rounded-xl skeleton mx-auto mb-3" />
        <div className="h-4 w-80 rounded-lg skeleton mx-auto" />
      </div>
      <div className="w-full max-w-xl space-y-4">
        <div className="h-64 rounded-3xl skeleton" />
      </div>
    </div>
  )
}
