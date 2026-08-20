import { CheckCircle2, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth.store"

import { authApi } from "../auth-api"
import { getAuthErrorMessage } from "../auth-errors"
import { AuthFormError } from "../components/AuthFormError"
import { AuthLayout } from "../components/AuthLayout"

type VerificationStatus = "error" | "pending" | "success"

export function VerifyEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const authStatus = useAuthStore((state) => state.status)
  const started = useRef(false)
  const [token] = useState(() =>
    new URLSearchParams(location.search).get("token")
  )
  const [status, setStatus] = useState<VerificationStatus>(
    token ? "pending" : "error"
  )
  const [error, setError] = useState<string | null>(
    token ? null : "This verification link is missing or invalid."
  )

  useEffect(() => {
    if (!token || started.current) {
      return
    }

    started.current = true
    navigate("/verify-email", { replace: true })

    void authApi
      .confirmEmail({ token })
      .then(() => {
        const user = useAuthStore.getState().user
        if (user) {
          useAuthStore.getState().setUser({ ...user, emailVerified: true })
        }
        setStatus("success")
      })
      .catch((requestError: unknown) => {
        setError(
          getAuthErrorMessage(
            requestError,
            "This verification link is invalid or has expired."
          )
        )
        setStatus("error")
      })
  }, [navigate, token])

  return (
    <AuthLayout
      title="Verify your email"
      description="Confirming your email keeps your account and workspace secure."
    >
      {status === "pending" && (
        <div className="py-3 text-center" role="status">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Verifying your email
          </p>
        </div>
      )}

      {status === "success" && (
        <div className="text-center" role="status">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <h2 className="mt-3 font-heading text-base font-semibold text-foreground">
            Email verified
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your account is ready to continue.
          </p>
          <Button
            className="mt-5"
            onClick={() =>
              navigate(
                authStatus === "authenticated" ? "/dashboard" : "/login",
                { replace: true }
              )
            }
          >
            {authStatus === "authenticated"
              ? "Continue to NestShip"
              : "Continue to sign in"}
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <AuthFormError message={error} />
          <Link
            className="block text-center text-sm font-medium text-primary hover:underline"
            to="/login"
          >
            Return to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
