import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, KeyRound, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card"
import { authApi } from "@/features/auth/auth-api"
import { getAuthErrorMessage } from "@/features/auth/auth-errors"
import { useAuthStore } from "@/stores/auth.store"

export function ChangePasswordCard() {
  const user = useAuthStore((state) => state.user)
  const requestReset = useMutation({
    mutationFn: () => authApi.forgotPassword({ email: user?.email ?? "" }),
  })

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-8 p-6 md:flex-row">
        <div className="space-y-1 md:w-1/3">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <KeyRound />
            </span>
            <CardTitle>Change password</CardTitle>
          </div>
          <CardDescription>
            Send a secure password reset link to your verified email address.
          </CardDescription>
        </div>

        <div className="md:w-2/3">
          <p className="text-sm text-muted-foreground">
            The reset link will be sent to {user?.email}.
          </p>
          {requestReset.isSuccess && (
            <p
              className="mt-3 flex items-center gap-1.5 text-sm text-success"
              role="status"
            >
              <CheckCircle2 />
              Reset email sent
            </p>
          )}
          {requestReset.isError && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {getAuthErrorMessage(requestReset.error)}
            </p>
          )}
        </div>
      </div>
      <CardFooter className="flex justify-end border-t border-border bg-secondary/20 p-4">
        <Button
          variant="outline"
          disabled={requestReset.isPending}
          onClick={() => requestReset.mutate()}
        >
          {requestReset.isPending && <LoaderCircle className="animate-spin" />}
          Send reset email
        </Button>
      </CardFooter>
    </Card>
  )
}
