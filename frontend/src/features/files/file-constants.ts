import type { FileResponseDto, InitiateFileUploadDto } from "@/api/generated"

export const FILE_MAX_SIZE_BYTES = 25 * 1024 * 1024
export const FILE_PAGE_SIZE = 20

export const acceptedFileTypes = {
  ".csv": "text/csv",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const satisfies Record<string, InitiateFileUploadDto["mimeType"]>

export type VisibleFileStatus = Exclude<FileResponseDto["status"], "PURGED">

export const fileStatusOptions: Array<{
  label: string
  value: VisibleFileStatus | "ACTIVE"
}> = [
  { label: "Active files", value: "ACTIVE" },
  { label: "Ready", value: "READY" },
  { label: "Processing", value: "SCANNING" },
  { label: "Awaiting upload", value: "PENDING" },
  { label: "Deleted", value: "DELETED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Failed", value: "FAILED" },
]

export const acceptedFileTypeLabel =
  "PDF, JPG, PNG, WebP, TXT, CSV, JSON, DOCX, XLSX, or PPTX"

export function getAcceptedMimeType(fileName: string) {
  const dot = fileName.lastIndexOf(".")
  if (dot < 0) return null
  const extension = fileName.slice(dot).toLowerCase()
  return acceptedFileTypes[extension as keyof typeof acceptedFileTypes] ?? null
}
