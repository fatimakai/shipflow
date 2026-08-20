import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore } from "@/stores/auth.store"

import { restoreSession } from "../auth-session"
import { SessionStateScreen } from "./SessionStateScreen"

export function ProtectedRoute() {
  const location = useLocation()
  const status = useAuthStore((state) => state.status)
  const restoreError = useAuthStore((state) => state.restoreError)

  if (status === "restoring") {
    return <SessionStateScreen />
  }

  if (status === "error") {
    return (
      <SessionStateScreen
        error={restoreError}
        onRetry={() => void restoreSession()}
      />
    )
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const location = useLocation()
  const status = useAuthStore((state) => state.status)

  if (status === "restoring") {
    return <SessionStateScreen />
  }

  if (status === "authenticated") {
    const state = location.state as {
      from?: { hash?: string; pathname?: string; search?: string }
    } | null
    const pathname = state?.from?.pathname
    const returnPath =
      pathname?.startsWith("/") && !pathname.startsWith("//")
        ? `${pathname}${state?.from?.search ?? ""}${state?.from?.hash ?? ""}`
        : "/dashboard"

    return <Navigate to={returnPath} replace />
  }

  return <Outlet />
}
