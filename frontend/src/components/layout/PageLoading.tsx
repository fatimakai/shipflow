import { LoaderCircle } from "lucide-react"

export function PageLoading() {
  return (
    <div
      className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
      aria-live="polite"
      role="status"
    >
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading page...
    </div>
  )
}
