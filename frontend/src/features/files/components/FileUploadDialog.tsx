import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Upload,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { FileUsageResponseDto } from "@/api/generated"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { acceptedFileTypeLabel, acceptedFileTypes } from "../file-constants"
import { getFileErrorMessage } from "../file-errors"
import { formatBytes } from "../file-format"
import type { FileUploadPhase } from "../use-file-uploader"
import { useFileUploader } from "../use-file-uploader"

const activePhases: FileUploadPhase[] = [
  "hashing",
  "reserving",
  "uploading",
  "finalizing",
]

function phaseLabel(phase: FileUploadPhase) {
  if (phase === "hashing") return "Checking file integrity"
  if (phase === "reserving") return "Reserving secure storage"
  if (phase === "uploading") return "Uploading"
  if (phase === "finalizing") return "Validating upload"
  if (phase === "success") return "Upload complete"
  if (phase === "canceled") return "Upload canceled"
  return "Upload failed"
}

export function FileUploadDialog({
  onOpenChange,
  onFailure,
  open,
  organizationId,
  usage,
}: {
  onOpenChange: (open: boolean) => void
  onFailure: (error: unknown) => void
  open: boolean
  organizationId: string
  usage?: FileUsageResponseDto
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const uploader = useFileUploader(organizationId)
  const task = uploader.task
  const isActive = task ? activePhases.includes(task.phase) : false

  useEffect(() => {
    if (task?.phase === "error" && task.error) onFailure(task.error)
  }, [onFailure, task?.error, task?.phase])

  const chooseFile = (file?: File) => {
    if (file) void uploader.start(file, usage)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (isActive) uploader.cancel()
      uploader.reset()
      setDragging(false)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload file</DialogTitle>
          <DialogDescription>
            Files are validated before becoming available to the workspace.
          </DialogDescription>
        </DialogHeader>

        {!task ? (
          <div
            className={`flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              chooseFile(event.dataTransfer.files[0])
            }}
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload />
            </span>
            <p className="font-medium">Drop a file here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {acceptedFileTypeLabel}, up to 25 MiB.
            </p>
            <Button className="mt-5" onClick={() => input.current?.click()}>
              <Upload />
              Choose file
            </Button>
            <input
              ref={input}
              className="sr-only"
              type="file"
              aria-label="Select file to upload"
              accept={Object.keys(acceptedFileTypes).join(",")}
              onChange={(event) => {
                chooseFile(event.target.files?.[0])
                event.target.value = ""
              }}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-border p-5">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${task.phase === "error" ? "bg-danger/10 text-danger" : task.phase === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}
              >
                {task.phase === "error" ? (
                  <AlertCircle />
                ) : task.phase === "success" ? (
                  <CheckCircle2 />
                ) : task.phase === "canceled" ? (
                  <X />
                ) : (
                  <LoaderCircle className="animate-spin" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{task.file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatBytes(task.file.size)} - {phaseLabel(task.phase)}
                </p>
              </div>
            </div>

            {(task.phase === "uploading" || task.phase === "finalizing") && (
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>{phaseLabel(task.phase)}</span>
                  <span>{task.progress}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-label="File upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={task.progress}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}

            {task.phase === "error" && (
              <p className="mt-4 text-sm text-danger" role="alert">
                {getFileErrorMessage(
                  task.error,
                  "The upload could not be completed."
                )}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {isActive && (
            <Button variant="outline" onClick={uploader.cancel}>
              <X />
              Cancel upload
            </Button>
          )}
          {task && (task.phase === "error" || task.phase === "canceled") && (
            <Button onClick={uploader.retry}>
              <RefreshCw />
              Retry
            </Button>
          )}
          {task?.phase === "success" && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
