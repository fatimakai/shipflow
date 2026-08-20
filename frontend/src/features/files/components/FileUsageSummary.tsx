import { AlertCircle, HardDrive, RefreshCw } from "lucide-react"

import type { FileUsageResponseDto } from "@/api/generated"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

import { formatBytes } from "../file-format"

export function FileUsageSummary({
  data,
  isError,
  isLoading,
  onRetry,
}: {
  data?: FileUsageResponseDto
  isError: boolean
  isLoading: boolean
  onRetry: () => void
}) {
  if (isLoading) return <Skeleton className="h-28 w-full rounded-lg" />

  if (isError || !data) {
    return (
      <Card className="flex min-h-28 items-center justify-between gap-4 rounded-lg p-5">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-danger" />
          <div>
            <p className="text-sm font-medium">Storage usage unavailable</p>
            <p className="text-xs text-muted-foreground">
              File operations may still be available.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          Retry
        </Button>
      </Card>
    )
  }

  const bytePercentage = data.maxBytes
    ? Math.min(100, Math.round((data.usedBytes / data.maxBytes) * 100))
    : 0
  const filePercentage = data.maxFiles
    ? Math.min(100, Math.round((data.usedFiles / data.maxFiles) * 100))
    : 0
  const percentage = Math.max(bytePercentage, filePercentage)

  return (
    <Card className="rounded-lg p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <HardDrive />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Workspace storage</p>
            <p className="text-sm text-muted-foreground">
              {formatBytes(data.usedBytes)} of {formatBytes(data.maxBytes)} used
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.usedFiles.toLocaleString()} of {data.maxFiles.toLocaleString()}{" "}
          files
        </p>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label="Workspace storage usage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <div
          className={`h-full rounded-full ${percentage >= 90 ? "bg-danger" : "bg-primary"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Card>
  )
}
