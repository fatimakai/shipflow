export function formatNotificationTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "Recently"

  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  const units = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
  ] as const
  let valueInUnit = seconds

  for (const [threshold, unit] of units) {
    if (Math.abs(valueInUnit) < threshold) {
      return formatter.format(valueInUnit, unit)
    }
    valueInUnit = Math.round(valueInUnit / threshold)
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp))
}
