import { useMutation } from "@tanstack/react-query"
import { Laptop, LoaderCircle, LogOut } from "lucide-react"
import { useState } from "react"

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
import { getAuthErrorMessage } from "@/features/auth/auth-errors"
import { signOutAll } from "@/features/auth/auth-session"

export function ActiveSessionsCard() {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const logoutEverywhere = useMutation({ mutationFn: signOutAll })

  return (
    <Card className="overflow-hidden border-danger/20">
      <div className="flex flex-col gap-8 p-6 md:flex-row">
        <div className="space-y-1 md:w-1/3">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-danger/10 text-danger">
              <Laptop />
            </span>
            <CardTitle>Active sessions</CardTitle>
          </div>
          <CardDescription>
            Revoke every active session if your account may be compromised.
          </CardDescription>
        </div>

        <div className="md:w-2/3">
          <p className="text-sm text-muted-foreground">
            This signs you out on every browser and device, including this one.
          </p>
          {logoutEverywhere.isError && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {getAuthErrorMessage(logoutEverywhere.error)}
            </p>
          )}
        </div>
      </div>
      <CardFooter className="flex justify-end border-t border-border bg-secondary/20 p-4">
        <Button
          variant="destructive"
          disabled={logoutEverywhere.isPending}
          onClick={() => setShowLogoutConfirm(true)}
        >
          {logoutEverywhere.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <LogOut />
          )}
          Log out all devices
        </Button>
      </CardFooter>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out on every device?</DialogTitle>
            <DialogDescription>
              All active sessions will be revoked and you will return to sign
              in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowLogoutConfirm(false)
                logoutEverywhere.mutate()
              }}
            >
              Log out all devices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
