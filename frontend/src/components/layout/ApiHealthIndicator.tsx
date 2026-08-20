import { useApiReadiness } from "@/api/health"

export function ApiHealthIndicator() {
  const readiness = useApiReadiness()
  const isConnected = readiness.data?.status === "ok"
  const label = readiness.isPending
    ? "Checking API"
    : isConnected
      ? "API connected"
      : "API unavailable"

  return (
    <div
      className="flex items-center gap-2 px-5 py-2 text-xs text-muted-foreground"
      role="status"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          readiness.isPending
            ? "bg-warning"
            : isConnected
              ? "bg-success"
              : "bg-danger"
        }`}
      />
      {label}
    </div>
  )
}
