import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react"
import { useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { organizationApi } from "../organization-api"
import { getOrganizationErrorMessage } from "../organization-errors"
import { organizationKeys } from "../organization-queries"
import { clearActiveOrganizationData } from "../organization-session"

export function AcceptInvitationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const hasStarted = useRef(false)
  const token = searchParams.get("token") ?? ""
  const tokenIsValid = token.length >= 32 && token.length <= 256
  const acceptance = useMutation({
    mutationFn: () => organizationApi.acceptInvitation({ token }),
    onSuccess: async () => {
      await clearActiveOrganizationData(queryClient)
      await queryClient.invalidateQueries({ queryKey: organizationKeys.list })
    },
  })

  useEffect(() => {
    if (tokenIsValid && !hasStarted.current) {
      hasStarted.current = true
      acceptance.mutate()
    }
  }, [acceptance, tokenIsValid])

  const isSuccess = acceptance.isSuccess
  const isError = !tokenIsValid || acceptance.isError

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          {isSuccess ? (
            <CircleCheck className="h-10 w-10 text-success" />
          ) : isError ? (
            <CircleX className="h-10 w-10 text-danger" />
          ) : (
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
          )}
          <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">
            {isSuccess
              ? "Invitation accepted"
              : isError
                ? "Invitation unavailable"
                : "Joining organization"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSuccess
              ? "Your membership is ready."
              : isError
                ? tokenIsValid
                  ? getOrganizationErrorMessage(
                      acceptance.error,
                      "This invitation could not be accepted."
                    )
                  : "This invitation link is invalid."
                : "We are verifying your invitation."}
          </p>
          {(isSuccess || isError) && (
            <Button
              className="mt-6"
              onClick={() => navigate("/dashboard", { replace: true })}
            >
              {isSuccess ? "Open dashboard" : "Return to dashboard"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
