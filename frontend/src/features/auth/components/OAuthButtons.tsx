import { Button } from "@/components/ui/button"
import { env } from "@/config/env"
import { useLocation } from "react-router-dom"

import { authApi } from "../auth-api"
import { rememberAuthReturnPath } from "../auth-return-path"

interface OAuthLocationState {
  from?: { hash?: string; pathname?: string; search?: string }
}

export function OAuthButtons() {
  const location = useLocation()
  const state = location.state as OAuthLocationState | null

  if (!env.googleOAuthEnabled && !env.githubOAuthEnabled) {
    return null
  }

  const beginOAuth = (provider: "github" | "google") => {
    rememberAuthReturnPath(state?.from)
    window.location.assign(authApi.oauthUrl(provider))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {env.googleOAuthEnabled && (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => beginOAuth("google")}
          >
            Google
          </Button>
        )}
        {env.githubOAuthEnabled && (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => beginOAuth("github")}
          >
            GitHub
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
