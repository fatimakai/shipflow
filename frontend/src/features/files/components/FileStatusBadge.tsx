import type { FileResponseDto } from "@/api/generated"
import { Badge } from "@/components/ui/badge"

const statusLabels: Record<FileResponseDto["status"], string> = {
  DELETED: "Deleted",
  FAILED: "Failed",
  PENDING: "Awaiting upload",
  PURGED: "Purged",
  READY: "Ready",
  REJECTED: "Rejected",
  SCANNING: "Scanning",
}

export function FileStatusBadge({
  status,
}: {
  status: FileResponseDto["status"]
}) {
  const variant =
    status === "FAILED" || status === "REJECTED"
      ? "destructive"
      : status === "READY"
        ? "default"
        : "secondary"

  return <Badge variant={variant}>{statusLabels[status]}</Badge>
}
