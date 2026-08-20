import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { authApi } from "../auth-api"
import { getAuthErrorMessage } from "../auth-errors"
import { loginSchema, type LoginValues } from "../auth-schemas"
import { applyAuthentication } from "../auth-session"
import { AuthFormError } from "../components/AuthFormError"
import { AuthLayout } from "../components/AuthLayout"
import { OAuthButtons } from "../components/OAuthButtons"
import { PasswordInput } from "../components/PasswordInput"

interface LoginLocationState {
  from?: { hash?: string; pathname?: string; search?: string }
  notice?: string
}

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as LoginLocationState | null
  const form = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(loginSchema),
  })
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (authentication) => {
      applyAuthentication(authentication)
      const returnPath = state?.from?.pathname
        ? `${state.from.pathname}${state.from.search ?? ""}${state.from.hash ?? ""}`
        : "/dashboard"
      navigate(returnPath, { replace: true })
    },
  })

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to continue to your NestShip workspace."
      footer={
        <>
          New to NestShip?{" "}
          <Link
            className="font-medium text-primary hover:underline"
            to="/register"
          >
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {state?.notice && (
          <div
            className="rounded-md border border-success/20 bg-success/10 px-3 py-2.5 text-sm text-success"
            role="status"
          >
            {state.notice}
          </div>
        )}

        <OAuthButtons />

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => login.mutate(values))}
          noValidate
        >
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
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="password">Password</Label>
              <Link
                className="text-xs font-medium text-primary hover:underline"
                to="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-danger">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <AuthFormError
            message={login.isError ? getAuthErrorMessage(login.error) : null}
          />

          <Button
            className="h-9 w-full"
            type="submit"
            disabled={login.isPending}
          >
            {login.isPending && <LoaderCircle className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
