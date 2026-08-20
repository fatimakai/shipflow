import { useState } from "react"
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card"

export function TwoFactorCard() {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false)

  const handleToggle2FA = () => {
    setIs2FAEnabled((prev) => !prev)
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row gap-8 p-6">
        {/* Header Section - 1/3 width on md+ */}
        <div className="md:w-1/3 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
          <Badge
            className={
              is2FAEnabled
                ? "border-success/20 bg-success/10 text-success hover:bg-success/10 w-fit"
                : "border-warning/20 bg-warning/10 text-warning hover:bg-warning/10 w-fit"
            }
          >
            {is2FAEnabled ? "Enabled" : "Disabled"}
          </Badge>
          <CardDescription className="pt-2">
            Add an extra layer of security using a time-based one-time password
            (TOTP) authenticator app.
          </CardDescription>
        </div>

        {/* Content Section - 2/3 width on md+ */}
        <div className="md:w-2/3 space-y-5">
          {is2FAEnabled ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Authenticator app configured
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You are using an authenticator app for two-factor
                    authentication. When prompted, enter the 6-digit code from
                    your app.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-3">
                <KeyRound className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Recovery codes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recovery codes allow you to access your account if you lose
                    your authenticator device. Keep them somewhere safe.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 h-7 text-xs"
                  >
                    View recovery codes
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor authentication adds an additional layer of security
                to your account by requiring more than just a password to sign
                in.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[
                  {
                    step: "1",
                    title: "Install app",
                    desc: "Download Google Authenticator, Authy, or any TOTP app.",
                  },
                  {
                    step: "2",
                    title: "Scan QR code",
                    desc: "Scan the QR code we provide with your authenticator app.",
                  },
                  {
                    step: "3",
                    title: "Enter code",
                    desc: "Enter the 6-digit verification code from the app.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1.5"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {item.step}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <CardFooter className="flex justify-end border-t border-border bg-secondary/20 p-4">
        {is2FAEnabled ? (
          <Button
            variant="outline"
            className="text-danger hover:text-danger hover:bg-danger/10 border-danger/30"
            onClick={handleToggle2FA}
          >
            Disable 2FA
          </Button>
        ) : (
          <Button onClick={handleToggle2FA}>Enable 2FA</Button>
        )}
      </CardFooter>
    </Card>
  )
}
