import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { authApi } from "../auth-api"
import { getAuthErrorMessage } from "../auth-errors"
import { twoFactorCodeSchema, type TwoFactorCodeValues } from "../auth-schemas"
import { applyAuthentication } from "../auth-session"
import { AuthFormError } from "../components/AuthFormError"
import { AuthLayout } from "../components/AuthLayout"

interface ChallengeLocationState {
  challengeToken?: string
  from?: { hash?: string; pathname?: string; search?: string }
}

export function TwoFactorChallengePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as ChallengeLocationState | null
  const fragmentChallenge = new URLSearchParams(
    location.hash.replace(/^#/, "")
  ).get("challenge")
  const challengeToken = state?.challengeToken ?? fragmentChallenge
  const form = useForm<TwoFactorCodeValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(twoFactorCodeSchema),
  })
  const verification = useMutation({
    mutationFn: authApi.twoFactor.verifyChallenge,
    onSuccess: (authentication) => {
      applyAuthentication(authentication)
      const returnPath = state?.from?.pathname
        ? `${state.from.pathname}${state.from.search ?? ""}${state.from.hash ?? ""}`
        : "/dashboard"
      navigate(returnPath, { replace: true })
    },
  })

  useEffect(() => {
    if (!fragmentChallenge) return

    navigate(location.pathname, {
      replace: true,
      state: { ...state, challengeToken: fragmentChallenge },
    })
  }, [fragmentChallenge, location.pathname, navigate, state])

  if (!challengeToken) {
    return (
      <AuthLayout
        title="Verification link unavailable"
        description="This two-factor challenge is missing or has already been cleared."
        footer={
          <Link
            className="font-medium text-primary hover:underline"
            to="/login"
          >
            Return to sign in
          </Link>
        }
      >
        <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 text-sm text-foreground">
          Start a new sign-in attempt to receive another five-minute challenge.
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Verify it’s you"
      description="Enter the six-digit code from your authenticator app, or use one of your recovery codes."
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Cancel and return to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Second factor required
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              This challenge expires after five minutes and can only be
              completed once.
            </p>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            verification.mutate({
              challengeToken,
              code: values.code.trim(),
            })
          )}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="two-factor-code">
              Authenticator or recovery code
            </Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="two-factor-code"
                className="h-10 pl-9 font-mono tracking-wider"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={Boolean(form.formState.errors.code)}
                autoFocus
                {...form.register("code")}
              />
            </div>
            {form.formState.errors.code && (
              <p className="text-xs text-danger">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>

          <AuthFormError
            message={
              verification.isError
                ? getAuthErrorMessage(
                    verification.error,
                    "That code or challenge could not be verified."
                  )
                : null
            }
          />

          <Button
            className="h-9 w-full"
            type="submit"
            disabled={verification.isPending}
          >
            {verification.isPending && (
              <LoaderCircle className="animate-spin" />
            )}
            Verify and continue
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
