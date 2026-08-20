import { Button } from "@/components/ui/button"
import { env } from "@/config/env"

import { authApi } from "../auth-api"

export function OAuthButtons() {
  if (!env.googleOAuthEnabled && !env.githubOAuthEnabled) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {env.googleOAuthEnabled && (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => window.location.assign(authApi.oauthUrl("google"))}
          >
            Google
          </Button>
        )}
        {env.githubOAuthEnabled && (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => window.location.assign(authApi.oauthUrl("github"))}
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
