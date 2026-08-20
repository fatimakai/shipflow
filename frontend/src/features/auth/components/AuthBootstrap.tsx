import { useEffect } from "react"

import { restoreSession } from "../auth-session"

export function AuthBootstrap() {
  useEffect(() => {
    void restoreSession()
  }, [])

  return null
}
