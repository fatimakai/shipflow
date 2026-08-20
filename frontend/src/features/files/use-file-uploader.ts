import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import type {
  FileUploadReservationResponseDto,
  FileUsageResponseDto,
} from "@/api/generated"

import { fileApi } from "./file-api"
import { fileKeys } from "./file-queries"
import {
  calculateSha256,
  type FileTransfer,
  uploadToSignedTarget,
  validateUploadFile,
} from "./file-transfer"

export type FileUploadPhase =
  | "hashing"
  | "reserving"
  | "uploading"
  | "finalizing"
  | "success"
  | "error"
  | "canceled"

export interface FileUploadTask {
  error?: unknown
  file: File
  phase: FileUploadPhase
  progress: number
}

interface UploadContext {
  file: File
  reservation: FileUploadReservationResponseDto
  transferred: boolean
}

export function useFileUploader(organizationId: string) {
  const queryClient = useQueryClient()
  const [task, setTask] = useState<FileUploadTask | null>(null)
  const context = useRef<UploadContext | null>(null)
  const operation = useRef(0)
  const transfer = useRef<FileTransfer | null>(null)

  const refresh = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: fileKeys.scope(organizationId),
      }),
    [organizationId, queryClient]
  )

  const continueUpload = useCallback(
    async (uploadContext: UploadContext, operationId: number) => {
      const isCurrent = () => operation.current === operationId

      try {
        if (!uploadContext.transferred) {
          if (
            new Date(uploadContext.reservation.upload.expiresAt).getTime() <=
            Date.now()
          ) {
            throw new Error(
              "The upload reservation expired. Start the upload again."
            )
          }
          if (!isCurrent()) return
          setTask({ file: uploadContext.file, phase: "uploading", progress: 0 })
          transfer.current = uploadToSignedTarget(
            uploadContext.reservation.upload,
            uploadContext.file,
            (progress) => {
              if (isCurrent()) {
                setTask({
                  file: uploadContext.file,
                  phase: "uploading",
                  progress,
                })
              }
            }
          )
          await transfer.current.promise
          uploadContext.transferred = true
        }

        if (!isCurrent()) return
        setTask({
          file: uploadContext.file,
          phase: "finalizing",
          progress: 100,
        })
        await fileApi.completeUpload(
          organizationId,
          uploadContext.reservation.file.id
        )
        if (!isCurrent()) return
        await refresh()
        context.current = null
        setTask({ file: uploadContext.file, phase: "success", progress: 100 })
      } catch (error) {
        if (!isCurrent()) return
        if (error instanceof DOMException && error.name === "AbortError") {
          setTask({ file: uploadContext.file, phase: "canceled", progress: 0 })
        } else {
          setTask({
            error,
            file: uploadContext.file,
            phase: "error",
            progress: uploadContext.transferred ? 100 : 0,
          })
        }
      } finally {
        if (isCurrent()) transfer.current = null
      }
    },
    [organizationId, refresh]
  )

  const start = useCallback(
    async (file: File, usage?: FileUsageResponseDto) => {
      const operationId = ++operation.current
      transfer.current?.cancel()
      context.current = null

      try {
        const mimeType = validateUploadFile(file, usage)
        setTask({ file, phase: "hashing", progress: 0 })
        const checksumSha256 = await calculateSha256(file)
        if (operation.current !== operationId) return

        setTask({ file, phase: "reserving", progress: 0 })
        const reservation = await fileApi.initiateUpload(organizationId, {
          checksumSha256,
          fileName: file.name,
          mimeType,
          sizeBytes: file.size,
        })
        if (operation.current !== operationId) return

        const uploadContext = { file, reservation, transferred: false }
        context.current = uploadContext
        await continueUpload(uploadContext, operationId)
      } catch (error) {
        if (operation.current === operationId) {
          setTask({ error, file, phase: "error", progress: 0 })
        }
      }
    },
    [continueUpload, organizationId]
  )

  const cancel = useCallback(() => {
    operation.current += 1
    transfer.current?.cancel()
    transfer.current = null
    setTask((current) =>
      current
        ? { file: current.file, phase: "canceled", progress: current.progress }
        : current
    )
  }, [])

  const retry = useCallback(() => {
    if (!task) return
    const uploadContext = context.current
    if (
      uploadContext &&
      new Date(uploadContext.reservation.upload.expiresAt).getTime() >
        Date.now()
    ) {
      const operationId = ++operation.current
      void continueUpload(uploadContext, operationId)
      return
    }
    void start(task.file)
  }, [continueUpload, start, task])

  const reset = useCallback(() => {
    operation.current += 1
    transfer.current?.cancel()
    transfer.current = null
    context.current = null
    setTask(null)
  }, [])

  useEffect(() => reset, [organizationId, reset])

  return { cancel, reset, retry, start, task }
}
