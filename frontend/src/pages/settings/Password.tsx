import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, LoaderCircle, LogOut, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { authApi } from "@/features/auth/auth-api"
import { getAuthErrorMessage } from "@/features/auth/auth-errors"
import { signOutAll } from "@/features/auth/auth-session"
import { useAuthStore } from "@/stores/auth.store"

export function Password() {
  const user = useAuthStore((state) => state.user)
  const requestReset = useMutation({
    mutationFn: () => authApi.forgotPassword({ email: user?.email ?? "" }),
  })
  const logoutEverywhere = useMutation({ mutationFn: signOutAll })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Change password</CardTitle>
              <CardDescription className="mt-1">
                Send a secure password reset link to {user?.email}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            {requestReset.isSuccess && (
              <span
                className="flex items-center gap-1 text-success"
                role="status"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Reset email sent
              </span>
            )}
            {requestReset.isError && (
              <span className="text-danger" role="alert">
                {getAuthErrorMessage(requestReset.error)}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            disabled={requestReset.isPending}
            onClick={() => requestReset.mutate()}
          >
            {requestReset.isPending && (
              <LoaderCircle className="animate-spin" />
            )}
            Send reset email
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-danger/20">
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Revoke every session, including this browser, and return to sign in.
          </CardDescription>
        </CardHeader>
        {logoutEverywhere.isError && (
          <CardContent>
            <p className="text-sm text-danger" role="alert">
              {getAuthErrorMessage(logoutEverywhere.error)}
            </p>
          </CardContent>
        )}
        <CardFooter className="justify-end">
          <Button
            variant="destructive"
            disabled={logoutEverywhere.isPending}
            onClick={() => logoutEverywhere.mutate()}
          >
            {logoutEverywhere.isPending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <LogOut />
            )}
            Log out all devices
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
