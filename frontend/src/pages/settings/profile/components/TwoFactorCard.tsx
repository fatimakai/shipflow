import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import QRCode from "qrcode"
import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import type { TwoFactorSetupResponseDto } from "@/api/generated"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authApi } from "@/features/auth/auth-api"
import { getAuthErrorMessage } from "@/features/auth/auth-errors"
import { clearSessionState } from "@/features/auth/auth-session"
import { PasswordInput } from "@/features/auth/components/PasswordInput"

const twoFactorStatusKey = ["auth", "two-factor-status"] as const

type StepUpOperation = "disable" | "regenerate"
type RecoveryCodeSource = "activation" | "regeneration"

export function TwoFactorCard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [setup, setSetup] = useState<TwoFactorSetupResponseDto | null>(null)
  const [setupCode, setSetupCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [recoveryCodeSource, setRecoveryCodeSource] =
    useState<RecoveryCodeSource | null>(null)
  const [stepUpOperation, setStepUpOperation] =
    useState<StepUpOperation | null>(null)
  const [stepUpCode, setStepUpCode] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const status = useQuery({
    queryKey: twoFactorStatusKey,
    queryFn: authApi.twoFactor.status,
  })
  const beginSetup = useMutation({
    mutationFn: authApi.twoFactor.beginSetup,
    onSuccess: (result) => {
      setSetup(result)
      setSetupCode("")
    },
  })
  const confirmSetup = useMutation({
    mutationFn: authApi.twoFactor.confirmSetup,
    onSuccess: (result) => {
      setSetup(null)
      setSetupCode("")
      setBackupCodes(result.backupCodes)
      setRecoveryCodeSource("activation")
      void queryClient.invalidateQueries({ queryKey: twoFactorStatusKey })
    },
  })
  const regenerate = useMutation({
    mutationFn: authApi.twoFactor.regenerateBackupCodes,
    onSuccess: (result) => {
      closeStepUp()
      setBackupCodes(result.backupCodes)
      setRecoveryCodeSource("regeneration")
      void queryClient.invalidateQueries({ queryKey: twoFactorStatusKey })
    },
  })
  const disable = useMutation({
    mutationFn: authApi.twoFactor.disable,
    onSuccess: () => {
      clearSessionState()
      navigate("/login", {
        replace: true,
        state: {
          notice:
            "Two-factor authentication was disabled. Sign in again to continue.",
        },
      })
    },
  })

  function closeStepUp() {
    setStepUpOperation(null)
    setStepUpCode("")
    setCurrentPassword("")
    regenerate.reset()
    disable.reset()
  }

  function submitStepUp() {
    if (!stepUpOperation || stepUpCode.trim().length < 6) return

    const payload = {
      code: stepUpCode.trim(),
      ...(currentPassword ? { currentPassword } : {}),
    }
    if (stepUpOperation === "regenerate") {
      regenerate.mutate(payload)
    } else {
      disable.mutate(payload)
    }
  }

  function finishRecoveryCodes() {
    setBackupCodes(null)
    const source = recoveryCodeSource
    setRecoveryCodeSource(null)

    if (source === "activation") {
      clearSessionState()
      navigate("/login", {
        replace: true,
        state: {
          notice:
            "Two-factor authentication is enabled. Sign in again to verify the new protection.",
        },
      })
    }
  }

  if (status.isPending) {
    return <TwoFactorCardShell status="Checking…" statusTone="neutral" />
  }

  if (status.isError || !status.data) {
    return (
      <TwoFactorCardShell status="Unavailable" statusTone="warning">
        <p className="text-sm text-danger" role="alert">
          {getAuthErrorMessage(
            status.error,
            "Unable to load two-factor settings."
          )}
        </p>
        <Button variant="outline" onClick={() => void status.refetch()}>
          <RefreshCw /> Try again
        </Button>
      </TwoFactorCardShell>
    )
  }

  if (backupCodes) {
    return (
      <TwoFactorCardShell status="Action required" statusTone="warning">
        <RecoveryCodesPanel codes={backupCodes} onDone={finishRecoveryCodes} />
      </TwoFactorCardShell>
    )
  }

  if (setup) {
    return (
      <TwoFactorCardShell status="Setup in progress" statusTone="warning">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <ProvisioningQrCode value={setup.provisioningUri} />
          <div className="space-y-5">
            <div>
              <h3 className="font-heading font-semibold text-foreground">
                Connect your authenticator
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Scan the QR code with any TOTP authenticator, then enter the
                current six-digit code.
              </p>
            </div>

            <ManualEntryKey value={setup.manualEntryKey} />

            <div className="max-w-sm space-y-2">
              <Label htmlFor="setup-authenticator-code">Six-digit code</Label>
              <Input
                id="setup-authenticator-code"
                className="h-10 font-mono tracking-[0.3em]"
                value={setupCode}
                onChange={(event) =>
                  setSetupCode(
                    event.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
              />
            </div>

            {confirmSetup.isError && (
              <p className="text-sm text-danger" role="alert">
                {getAuthErrorMessage(
                  confirmSetup.error,
                  "Unable to verify that code."
                )}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={setupCode.length !== 6 || confirmSetup.isPending}
                onClick={() => confirmSetup.mutate({ code: setupCode })}
              >
                {confirmSetup.isPending && (
                  <LoaderCircle className="animate-spin" />
                )}
                Verify and enable
              </Button>
              <Button
                variant="outline"
                disabled={confirmSetup.isPending}
                onClick={() => {
                  setSetup(null)
                  setSetupCode("")
                  confirmSetup.reset()
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </TwoFactorCardShell>
    )
  }

  const enabled = status.data.enabled

  return (
    <>
      <TwoFactorCardShell
        status={enabled ? "Enabled" : "Disabled"}
        statusTone={enabled ? "success" : "warning"}
        footer={
          enabled ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStepUpOperation("regenerate")}
              >
                <RefreshCw /> Replace recovery codes
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStepUpOperation("disable")}
              >
                Disable 2FA
              </Button>
            </div>
          ) : (
            <Button
              disabled={beginSetup.isPending}
              onClick={() => beginSetup.mutate()}
            >
              {beginSetup.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ShieldCheck />
              )}
              {status.data.setupPending ? "Restart setup" : "Enable 2FA"}
            </Button>
          )
        }
      >
        {enabled ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Authenticator protection is active
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Every password and OAuth sign-in must complete ShipFlow’s
                  second-factor challenge.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-4">
              <div className="flex items-center gap-3">
                <KeyRound className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Recovery codes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Single-use codes remaining
                  </p>
                </div>
              </div>
              <span className="font-heading text-xl font-semibold text-foreground">
                {status.data.backupCodesRemaining}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {status.data.setupPending && (
              <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-foreground">
                An unfinished setup exists. Restarting generates a new secret
                and invalidates the previous one.
              </div>
            )}
            <p className="text-sm leading-6 text-muted-foreground">
              Protect your account with an authenticator app. ShipFlow supports
              standard TOTP apps and gives you ten one-time recovery codes.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [
                  "1",
                  "Scan",
                  "Connect your authenticator using a private QR code.",
                ],
                ["2", "Verify", "Confirm setup with a current six-digit code."],
                [
                  "3",
                  "Save",
                  "Store your single-display recovery codes safely.",
                ],
              ].map(([step, title, description]) => (
                <div
                  key={step}
                  className="rounded-lg border border-border bg-secondary/40 p-3"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {step}
                  </span>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
            {beginSetup.isError && (
              <p className="text-sm text-danger" role="alert">
                {getAuthErrorMessage(
                  beginSetup.error,
                  "Unable to start setup."
                )}
              </p>
            )}
          </div>
        )}
      </TwoFactorCardShell>

      <StepUpDialog
        operation={stepUpOperation}
        code={stepUpCode}
        currentPassword={currentPassword}
        error={regenerate.error ?? disable.error}
        pending={regenerate.isPending || disable.isPending}
        onCodeChange={setStepUpCode}
        onPasswordChange={setCurrentPassword}
        onClose={closeStepUp}
        onSubmit={submitStepUp}
      />
    </>
  )
}

function TwoFactorCardShell({
  children,
  footer,
  status,
  statusTone,
}: {
  children?: ReactNode
  footer?: ReactNode
  status: string
  statusTone: "neutral" | "success" | "warning"
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-8 p-6 md:flex-row">
        <div className="space-y-1 md:w-1/3">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck />
            </span>
            <CardTitle>Two-factor authentication</CardTitle>
          </div>
          <Badge
            className={
              statusTone === "success"
                ? "w-fit border-success/20 bg-success/10 text-success hover:bg-success/10"
                : statusTone === "warning"
                  ? "w-fit border-warning/20 bg-warning/10 text-warning hover:bg-warning/10"
                  : "w-fit"
            }
          >
            {status}
          </Badge>
          <CardDescription className="pt-2">
            Require a second proof of identity whenever you sign in.
          </CardDescription>
        </div>
        <div className="space-y-4 md:w-2/3">{children}</div>
      </div>
      {footer && (
        <CardFooter className="flex justify-end border-t border-border bg-secondary/20 p-4">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}

function ProvisioningQrCode({ value }: { value: string }) {
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(value, {
      color: { dark: "#12121a", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    }).then((dataUrl) => {
      if (active) setSource(dataUrl)
    })

    return () => {
      active = false
    }
  }, [value])

  return (
    <div className="mx-auto flex size-[220px] items-center justify-center rounded-xl border border-border bg-white p-3 shadow-sm lg:mx-0">
      {source ? (
        <img
          src={source}
          alt="QR code for adding ShipFlow to an authenticator app"
          className="size-full"
        />
      ) : (
        <LoaderCircle className="size-6 animate-spin text-primary" />
      )}
    </div>
  )
}

function ManualEntryKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="space-y-2">
      <Label>Can’t scan it? Enter this key manually</Label>
      <div className="flex max-w-lg items-center gap-2 rounded-lg border border-border bg-secondary/50 p-2 pl-3">
        <code className="min-w-0 flex-1 break-all text-xs font-semibold tracking-wider text-foreground">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }}
        >
          {copied ? <Check /> : <Clipboard />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  )
}

function RecoveryCodesPanel({
  codes,
  onDone,
}: {
  codes: string[]
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  const content = ["ShipFlow recovery codes", "", ...codes].join("\n")

  function downloadCodes() {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "shipflow-recovery-codes.txt"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
        <p className="font-medium text-foreground">
          Save these recovery codes now
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          This is the only time ShipFlow will display them. Each code works
          once.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-secondary/40 p-4 sm:grid-cols-2">
        {codes.map((code) => (
          <code
            key={code}
            className="rounded-md border border-border bg-background px-3 py-2 text-center text-sm font-semibold tracking-wider text-foreground"
          >
            {code}
          </code>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard
              .writeText(content)
              .then(() => setCopied(true))
          }}
        >
          {copied ? <Check /> : <Clipboard />}
          {copied ? "Copied" : "Copy all"}
        </Button>
        <Button variant="outline" onClick={downloadCodes}>
          <Download /> Download .txt
        </Button>
        <Button onClick={onDone}>
          <CheckCircle2 /> I’ve saved these codes
        </Button>
      </div>
    </div>
  )
}

function StepUpDialog({
  code,
  currentPassword,
  error,
  onClose,
  onCodeChange,
  onPasswordChange,
  onSubmit,
  operation,
  pending,
}: {
  code: string
  currentPassword: string
  error: unknown
  onClose: () => void
  onCodeChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  operation: StepUpOperation | null
  pending: boolean
}) {
  const disabling = operation === "disable"

  return (
    <Dialog
      open={operation !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {disabling
              ? "Disable two-factor authentication?"
              : "Replace recovery codes?"}
          </DialogTitle>
          <DialogDescription>
            Confirm this security change with your current credentials.
            OAuth-only accounts can leave the password blank.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="two-factor-current-password">
              Current password
            </Label>
            <PasswordInput
              id="two-factor-current-password"
              value={currentPassword}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              placeholder="Not required for OAuth-only accounts"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="two-factor-step-up-code">
              Authenticator or recovery code
            </Label>
            <Input
              id="two-factor-step-up-code"
              className="h-10 font-mono tracking-wider"
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
          {error !== null && (
            <p className="text-sm text-danger" role="alert">
              {getAuthErrorMessage(
                error,
                "Unable to confirm this security change."
              )}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={disabling ? "destructive" : "default"}
            disabled={pending || code.trim().length < 6}
            onClick={onSubmit}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {disabling ? "Disable 2FA" : "Replace codes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
