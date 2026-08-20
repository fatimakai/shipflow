import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, RefreshCw, Upload, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import type { FileResponseDto } from "@/api/generated"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFileActions } from "@/features/files/file-actions"
import {
  fileStatusOptions,
  type VisibleFileStatus,
} from "@/features/files/file-constants"
import { getFileErrorMessage } from "@/features/files/file-errors"
import { useFiles, useFileUsage } from "@/features/files/file-queries"
import { FileList } from "@/features/files/components/FileList"
import { FileUploadDialog } from "@/features/files/components/FileUploadDialog"
import { FileUsageSummary } from "@/features/files/components/FileUsageSummary"
import { useDocumentVisibility } from "@/hooks/use-document-visibility"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"
import { useActiveOrganization } from "@/features/organizations/organization-queries"
import { recoverOrganizationAuthorization } from "@/features/organizations/organization-session"

type FileFilter = VisibleFileStatus | "ACTIVE"

export function Files() {
  const queryClient = useQueryClient()
  const organization = useActiveOrganization()
  const isVisible = useDocumentVisibility()
  const organizationId = organization?.id ?? null
  const [filter, setFilter] = useState<FileFilter>("ACTIVE")
  const [pagination, setPagination] = useState({ organizationId, page: 1 })
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FileResponseDto | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const page =
    pagination.organizationId === organizationId ? pagination.page : 1
  const apiStatus = filter === "ACTIVE" ? undefined : filter
  const canUpload = hasOrganizationCapability(organization, "file:upload")
  const canDelete = hasOrganizationCapability(organization, "file:delete")
  const files = useFiles(organizationId, {
    isVisible,
    page,
    status: apiStatus,
  })
  const usage = useFileUsage(organizationId)
  const actions = useFileActions(organizationId ?? "")

  const handleFailure = useCallback(
    async (failure: unknown) => {
      const recovered = organizationId
        ? await recoverOrganizationAuthorization(
            failure,
            organizationId,
            queryClient
          )
        : false
      if (!recovered) setErrorBanner(getFileErrorMessage(failure))
    },
    [organizationId, queryClient]
  )

  useEffect(() => {
    const failure = files.error ?? usage.error
    if (failure && organizationId) {
      void recoverOrganizationAuthorization(
        failure,
        organizationId,
        queryClient
      )
    }
  }, [files.error, organizationId, queryClient, usage.error])

  const setPage = (nextPage: number) =>
    setPagination({ organizationId, page: nextPage })

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await actions.deleteFile.mutateAsync(deleteTarget.id)
      toast.success(
        deleteTarget.status === "PENDING"
          ? "Upload reservation removed"
          : "File moved to recovery"
      )
      if (files.data?.items.length === 1 && page > 1) setPage(page - 1)
      setDeleteTarget(null)
    } catch (failure) {
      await handleFailure(failure)
    }
  }

  const handleRestore = async (file: FileResponseDto) => {
    try {
      await actions.restoreFile.mutateAsync(file.id)
      toast.success("File restored")
    } catch (failure) {
      await handleFailure(failure)
    }
  }

  const handleDownload = async (file: FileResponseDto) => {
    try {
      await actions.downloadFile.mutateAsync({
        id: file.id,
        name: file.originalName,
      })
    } catch (failure) {
      await handleFailure(failure)
    }
  }

  return (
    <div className="space-y-6">
      {errorBanner && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger/10 p-3.5 text-sm text-danger"
          role="alert"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setErrorBanner(null)}
            aria-label="Dismiss file error"
          >
            <X />
          </Button>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-heading text-2xl font-bold">Files</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Secure documents for {organization?.name ?? "your workspace"}.
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload />
            Upload file
          </Button>
        )}
      </div>

      <FileUsageSummary
        data={usage.data}
        isError={usage.isError}
        isLoading={usage.isPending}
        onRetry={() => void usage.refetch()}
      />

      <section aria-labelledby="workspace-files-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2
              id="workspace-files-heading"
              className="font-heading font-semibold"
            >
              Workspace files
            </h2>
            <p className="text-xs text-muted-foreground">
              {files.data?.pagination.total ?? 0} files in this view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onValueChange={(value) => {
                if (!value) return
                setFilter(value as FileFilter)
                setPage(1)
              }}
            >
              <SelectTrigger
                aria-label="Filter files by status"
                className="w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fileStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                void files.refetch()
                void usage.refetch()
              }}
              aria-label="Refresh files"
              title="Refresh"
            >
              <RefreshCw />
            </Button>
          </div>
        </div>

        <FileList
          canDelete={canDelete}
          data={files.data}
          deletePendingId={actions.deleteFile.variables}
          downloadPendingId={actions.downloadFile.variables?.id}
          errorMessage={
            files.error ? getFileErrorMessage(files.error) : undefined
          }
          isError={files.isError}
          isLoading={files.isPending}
          onDelete={setDeleteTarget}
          onDownload={(file) => void handleDownload(file)}
          onPageChange={setPage}
          onRestore={(file) => void handleRestore(file)}
          onRetry={() => void files.refetch()}
          restorePendingId={actions.restoreFile.variables}
        />
      </section>

      {organizationId && (
        <FileUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onFailure={handleFailure}
          organizationId={organizationId}
          usage={usage.data}
        />
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.status === "PENDING"
                ? "Remove upload reservation?"
                : "Delete file?"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.status === "PENDING"
                ? "The unfinished upload will be permanently removed."
                : "The file will remain recoverable for 30 days before permanent removal."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={actions.deleteFile.isPending}
              onClick={() => void handleDelete()}
            >
              Delete file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
