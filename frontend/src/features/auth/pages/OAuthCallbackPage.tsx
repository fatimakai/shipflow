import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

import { useAuthStore } from "@/stores/auth.store"

import { restoreSession } from "../auth-session"
import { consumeAuthReturnPath } from "../auth-return-path"
import { SessionStateScreen } from "../components/SessionStateScreen"

export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const navigationStarted = useRef(false)
  const status = useAuthStore((state) => state.status)
  const restoreError = useAuthStore((state) => state.restoreError)

  useEffect(() => {
    if (status !== "authenticated" || navigationStarted.current) return

    navigationStarted.current = true
    navigate(consumeAuthReturnPath(), { replace: true })
  }, [navigate, status])

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
