import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import { authApi } from "../auth-api"
import { getAuthErrorMessage } from "../auth-errors"
import { resetPasswordSchema, type ResetPasswordValues } from "../auth-schemas"
import { AuthFormError } from "../components/AuthFormError"
import { AuthLayout } from "../components/AuthLayout"
import { PasswordInput } from "../components/PasswordInput"

export function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() =>
    new URLSearchParams(location.search).get("token")
  )
  const form = useForm<ResetPasswordValues>({
    defaultValues: { confirmPassword: "", password: "" },
    resolver: zodResolver(resetPasswordSchema),
  })
  const resetPassword = useMutation({
    mutationFn: (values: ResetPasswordValues) =>
      authApi.resetPassword({ password: values.password, token: token ?? "" }),
  })

  useEffect(() => {
    if (token) {
      navigate("/reset-password", { replace: true })
    }
  }, [navigate, token])

  return (
    <AuthLayout
      title="Choose a new password"
      description="Your new password will sign out existing sessions."
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      {!token ? (
        <AuthFormError message="This reset link is missing or invalid. Request a new one to continue." />
      ) : resetPassword.isSuccess ? (
        <div className="text-center" role="status">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <h2 className="mt-3 font-heading text-base font-semibold text-foreground">
            Password updated
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            You can now sign in with your new password.
          </p>
          <Button
            className="mt-5"
            onClick={() => navigate("/login", { replace: true })}
          >
            Continue to sign in
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => resetPassword.mutate(values))}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              autoFocus
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <p className="text-xs text-muted-foreground">
              Use at least 12 characters.
            </p>
            {form.formState.errors.password && (
              <p className="text-xs text-danger">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              aria-invalid={Boolean(form.formState.errors.confirmPassword)}
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-danger">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <AuthFormError
            message={
              resetPassword.isError
                ? getAuthErrorMessage(
                    resetPassword.error,
                    "This reset link is invalid or has expired."
                  )
                : null
            }
          />

          <Button
            className="h-9 w-full"
            type="submit"
            disabled={resetPassword.isPending}
          >
            {resetPassword.isPending && (
              <LoaderCircle className="animate-spin" />
            )}
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
