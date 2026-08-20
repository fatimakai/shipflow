export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** unitIndex
  return `${value.toFixed(unitIndex === 0 || value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

export function formatFileDate(value: string | null | undefined) {
  if (!value) return "Not available"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Not available"
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatRecoveryDate(deletedAt: string | null | undefined) {
  if (!deletedAt) return null
  const recoveryEnd = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000
  if (!Number.isFinite(recoveryEnd)) return null
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(recoveryEnd))
}
