import { Navigate } from "react-router-dom"

import { useAuthStore } from "@/stores/auth.store"

import { restoreSession } from "../auth-session"
import { SessionStateScreen } from "../components/SessionStateScreen"

export function OAuthCallbackPage() {
  const status = useAuthStore((state) => state.status)
  const restoreError = useAuthStore((state) => state.restoreError)

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />
  }

  if (status === "error" || status === "unauthenticated") {
    return (
      <SessionStateScreen
        error={restoreError || "Unable to complete authentication."}
        onRetry={() => void restoreSession()}
      />
    )
  }

  return <SessionStateScreen />
}
