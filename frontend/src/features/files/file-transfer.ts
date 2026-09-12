import type {
  FileUploadTargetResponseDto,
  FileUsageResponseDto,
  InitiateFileUploadDto,
} from "@/api/generated"
import { env } from "@/config/env"

import {
  acceptedFileTypeLabel,
  FILE_MAX_SIZE_BYTES,
  getAcceptedMimeType,
} from "./file-constants"

export function validateUploadFile(
  file: File,
  usage?: FileUsageResponseDto
): InitiateFileUploadDto["mimeType"] {
  if (!file.name || file.name.length > 255 || /[/\\]/.test(file.name)) {
    throw new Error("Choose a file with a valid name up to 255 characters.")
  }
  if (file.size < 1) throw new Error("The selected file is empty.")
  if (file.size > FILE_MAX_SIZE_BYTES) {
    throw new Error("Files must be 25 MiB or smaller.")
  }

  const mimeType = getAcceptedMimeType(file.name)
  if (!mimeType)
    throw new Error(`Choose one of these file types: ${acceptedFileTypeLabel}.`)

  if (
    usage &&
    (usage.usedBytes + file.size > usage.maxBytes ||
      usage.usedFiles + 1 > usage.maxFiles)
  ) {
    throw new Error("This upload would exceed the workspace storage quota.")
  }

  return mimeType
}

export async function calculateSha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function resolveFileTransferUrl(value: string) {
  const apiOrigin = new URL(env.apiBaseUrl).origin
  const url = new URL(value, `${apiOrigin}/`)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The file transfer destination is invalid.")
  }
  return url.toString()
}

export interface FileTransfer {
  cancel: () => void
  promise: Promise<void>
}

export function uploadToSignedTarget(
  target: FileUploadTargetResponseDto,
  file: File,
  onProgress: (progress: number) => void
): FileTransfer {
  const request = new XMLHttpRequest()
  let body: File | FormData
  if (target.method === "PUT") {
    body = file
  } else {
    const formData = new FormData()
    Object.entries(target.fields).forEach(([key, value]) =>
      formData.append(key, value)
    )
    formData.append(target.fileField ?? "file", file, file.name)
    body = formData
  }

  const promise = new Promise<void>((resolve, reject) => {
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100))
        )
      }
    })
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(`File transfer failed with status ${request.status}.`))
      }
    })
    request.addEventListener("error", () =>
      reject(new Error("The file transfer was interrupted. Please try again."))
    )
    request.addEventListener("abort", () =>
      reject(new DOMException("File upload canceled", "AbortError"))
    )

    request.open(target.method, resolveFileTransferUrl(target.url))
    Object.entries(target.headers).forEach(([key, value]) =>
      request.setRequestHeader(key, value)
    )
    request.send(body)
  })

  return { cancel: () => request.abort(), promise }
}

export function startFileDownload(urlValue: string, fileName: string) {
  const link = document.createElement("a")
  link.href = resolveFileTransferUrl(urlValue)
  link.download = fileName
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
}
