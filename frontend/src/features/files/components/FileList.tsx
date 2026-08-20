import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react"

import type { FileListResponseDto, FileResponseDto } from "@/api/generated"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

import { formatBytes, formatFileDate, formatRecoveryDate } from "../file-format"
import { FileStatusBadge } from "./FileStatusBadge"
import { FileTypeIcon } from "./FileTypeIcon"

export function FileList({
  canDelete,
  data,
  deletePendingId,
  downloadPendingId,
  errorMessage,
  isError,
  isLoading,
  onDelete,
  onDownload,
  onPageChange,
  onRestore,
  onRetry,
  restorePendingId,
}: {
  canDelete: boolean
  data?: FileListResponseDto
  deletePendingId?: string
  downloadPendingId?: string
  errorMessage?: string
  isError: boolean
  isLoading: boolean
  onDelete: (file: FileResponseDto) => void
  onDownload: (file: FileResponseDto) => void
  onPageChange: (page: number) => void
  onRestore: (file: FileResponseDto) => void
  onRetry: () => void
  restorePendingId?: string
}) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden rounded-lg" aria-label="Loading files">
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-0"
          >
            <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="flex min-h-72 flex-col items-center justify-center rounded-lg p-6 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-danger" />
        <h2 className="font-heading text-base font-semibold">
          Could not load files
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {errorMessage}
        </p>
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          <RefreshCw />
          Retry
        </Button>
      </Card>
    )
  }

  if (!data?.items.length) {
    return (
      <Card className="flex min-h-72 flex-col items-center justify-center rounded-lg p-6 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <FileText />
        </span>
        <h2 className="font-heading text-base font-semibold">No files found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Files matching this status will appear here.
        </p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-lg">
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_8rem_8rem] gap-4 border-b border-border bg-secondary/30 px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
        <span>Name</span>
        <span>Uploaded by</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>

      {data.items.map((file) => {
        const recoveryDate = formatRecoveryDate(file.deletedAt)
        const canRemove = ["PENDING", "SCANNING", "READY"].includes(file.status)
        return (
          <div
            key={file.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-4 last:border-0 md:grid-cols-[auto_minmax(0,2fr)_minmax(8rem,1fr)_8rem_8rem] md:px-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <FileTypeIcon mimeType={file.mimeType} />
            </span>
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium"
                title={file.originalName}
              >
                {file.originalName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBytes(file.sizeBytes)} -{" "}
                {formatFileDate(file.uploadedAt ?? file.createdAt)}
              </p>
              <div className="mt-2 md:hidden">
                <FileStatusBadge status={file.status} />
              </div>
              {file.status === "DELETED" && recoveryDate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Recoverable until {recoveryDate}
                </p>
              )}
            </div>
            <p className="hidden truncate text-sm text-muted-foreground md:block">
              {file.uploadedBy.displayName ?? "Former member"}
            </p>
            <div className="hidden md:block">
              <FileStatusBadge status={file.status} />
            </div>
            <div className="flex justify-end gap-1">
              {file.status === "READY" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={downloadPendingId === file.id}
                  onClick={() => onDownload(file)}
                  aria-label={`Download ${file.originalName}`}
                  title="Download"
                >
                  <Download />
                </Button>
              )}
              {file.status === "DELETED" && canDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={restorePendingId === file.id}
                  onClick={() => onRestore(file)}
                  aria-label={`Restore ${file.originalName}`}
                  title="Restore"
                >
                  <RotateCcw />
                </Button>
              )}
              {canRemove && canDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  disabled={deletePendingId === file.id}
                  onClick={() => onDelete(file)}
                  aria-label={`Delete ${file.originalName}`}
                  title="Delete"
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        )
      })}

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={data.pagination.page <= 1}
              onClick={() => onPageChange(data.pagination.page - 1)}
              aria-label="Previous files page"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => onPageChange(data.pagination.page + 1)}
              aria-label="Next files page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
