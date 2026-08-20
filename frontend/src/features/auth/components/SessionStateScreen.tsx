import { LoaderCircle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

interface SessionStateScreenProps {
  error?: string | null
  message?: string
  onRetry?: () => void
}

export function SessionStateScreen({
  error,
  message = "Restoring your session",
  onRetry,
}: SessionStateScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        {error ? (
          <>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
            </div>
            <h1 className="font-heading text-lg font-semibold text-foreground">
              Session unavailable
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-5" onClick={onRetry}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          </>
        )}
      </div>
    </div>
  )
}
