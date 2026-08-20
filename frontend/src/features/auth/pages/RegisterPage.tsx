import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { authApi } from "../auth-api"
import { getAuthErrorMessage } from "../auth-errors"
import { registerSchema, type RegisterValues } from "../auth-schemas"
import { applyAuthentication } from "../auth-session"
import { AuthFormError } from "../components/AuthFormError"
import { AuthLayout } from "../components/AuthLayout"
import { OAuthButtons } from "../components/OAuthButtons"
import { PasswordInput } from "../components/PasswordInput"

export function RegisterPage() {
  const navigate = useNavigate()
  const form = useForm<RegisterValues>({
    defaultValues: {
      confirmPassword: "",
      displayName: "",
      email: "",
      password: "",
    },
    resolver: zodResolver(registerSchema),
  })
  const registerAccount = useMutation({
    mutationFn: (values: RegisterValues) =>
      authApi.register({
        displayName: values.displayName || undefined,
        email: values.email,
        password: values.password,
      }),
    onSuccess: (authentication) => {
      applyAuthentication(authentication)
      navigate("/dashboard", { replace: true })
    },
  })

  return (
    <AuthLayout
      title="Create your account"
      description="Set up your NestShip account and start a workspace."
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="font-medium text-primary hover:underline"
            to="/login"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <OAuthButtons />

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            registerAccount.mutate(values)
          )}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="display-name">Name</Label>
            <Input
              id="display-name"
              autoComplete="name"
              aria-invalid={Boolean(form.formState.errors.displayName)}
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName && (
              <p className="text-xs text-danger">
                {form.formState.errors.displayName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-danger">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
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
            <Label htmlFor="confirm-password">Confirm password</Label>
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
              registerAccount.isError
                ? getAuthErrorMessage(registerAccount.error)
                : null
            }
          />

          <Button
            className="h-9 w-full"
            type="submit"
            disabled={registerAccount.isPending}
          >
            {registerAccount.isPending && (
              <LoaderCircle className="animate-spin" />
            )}
            Create account
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
