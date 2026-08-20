import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, LoaderCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { authApi } from "../auth-api"
import { getAuthErrorMessage } from "../auth-errors"
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "../auth-schemas"
import { AuthFormError } from "../components/AuthFormError"
import { AuthLayout } from "../components/AuthLayout"

export function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordValues>({
    defaultValues: { email: "" },
    resolver: zodResolver(forgotPasswordSchema),
  })
  const forgotPassword = useMutation({ mutationFn: authApi.forgotPassword })

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your account email and we'll send the next step."
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      {forgotPassword.isSuccess ? (
        <div className="text-center" role="status">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <h2 className="mt-3 font-heading text-base font-semibold text-foreground">
            Check your inbox
          </h2>
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
            If an account matches that email, a password reset link is on its
            way.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            forgotPassword.mutate(values)
          )}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-danger">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <AuthFormError
            message={
              forgotPassword.isError
                ? getAuthErrorMessage(forgotPassword.error)
                : null
            }
          />

          <Button
            className="h-9 w-full"
            type="submit"
            disabled={forgotPassword.isPending}
          >
            {forgotPassword.isPending && (
              <LoaderCircle className="animate-spin" />
            )}
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
