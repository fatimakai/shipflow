import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, LoaderCircle, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth.store"

import { authApi } from "../auth-api"
import { getAuthErrorMessage } from "../auth-errors"

export function EmailVerificationBanner() {
  const user = useAuthStore((state) => state.user)
  const requestVerification = useMutation({
    mutationFn: authApi.requestEmailVerification,
  })

  if (!user || user.emailVerified) {
    return null
  }

  return (
    <div className="border-b border-warning/20 bg-warning/10 px-4 py-2.5 lg:px-6">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-foreground">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Verify <strong>{user.email}</strong> to secure your account.
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {requestVerification.isSuccess && (
            <span
              className="flex items-center gap-1 text-xs text-success"
              role="status"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Email sent
            </span>
          )}
          {requestVerification.isError && (
            <span className="text-xs text-danger" role="alert">
              {getAuthErrorMessage(requestVerification.error)}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={requestVerification.isPending}
            onClick={() => requestVerification.mutate()}
          >
            {requestVerification.isPending && (
              <LoaderCircle className="animate-spin" />
            )}
            Resend
          </Button>
        </div>
      </div>
    </div>
  )
}
