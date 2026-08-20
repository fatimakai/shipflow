import { useMutation } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authApi } from "@/features/auth/auth-api"
import { getAuthErrorMessage } from "@/features/auth/auth-errors"
import { useAuthStore } from "@/stores/auth.store"

export function PersonalInfoCard() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [draft, setDraft] = useState({
    userId: user?.id ?? "",
    value: user?.displayName ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const updateProfile = useMutation({
    mutationFn: authApi.updateProfile,
    onError: (failure) =>
      setError(getAuthErrorMessage(failure, "Unable to update profile.")),
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      setDraft({
        userId: updatedUser.id,
        value: updatedUser.displayName ?? "",
      })
      setError(null)
      toast.success("Profile updated")
    },
  })

  if (!user) return null

  const displayName =
    draft.userId === user.id ? draft.value : (user.displayName ?? "")
  const normalizedName = displayName.trim()
  const isUnchanged = normalizedName === (user.displayName ?? "")

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (normalizedName.length < 1 || normalizedName.length > 100) {
      setError("Use a display name between 1 and 100 characters.")
      return
    }

    setError(null)
    updateProfile.mutate({ displayName: normalizedName })
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <Card className="overflow-hidden">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-8 p-6 md:flex-row">
          <div className="space-y-1 md:w-1/3">
            <CardTitle>Personal information</CardTitle>
            <CardDescription>
              Update how your account appears across workspaces.
            </CardDescription>
          </div>

          <div className="space-y-5 md:w-2/3">
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="max-w-md space-y-2">
              <Label htmlFor="profile-display-name">Display name</Label>
              <Input
                id="profile-display-name"
                autoComplete="name"
                maxLength={100}
                value={displayName}
                onChange={(event) =>
                  setDraft({ userId: user.id, value: event.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Used in member lists and invitations.
              </p>
            </div>
            <div className="max-w-md space-y-2">
              <Label htmlFor="profile-email">Email address</Label>
              <Input id="profile-email" value={user.email} disabled readOnly />
            </div>
            <div className="max-w-md space-y-2">
              <Label htmlFor="profile-timezone">Timezone</Label>
              <Input
                id="profile-timezone"
                value={timezone || "Browser default"}
                disabled
                readOnly
              />
            </div>
          </div>
        </div>
        <CardFooter className="flex justify-end border-t border-border bg-secondary/20 p-4">
          <Button
            type="submit"
            disabled={updateProfile.isPending || isUnchanged}
          >
            {updateProfile.isPending && (
              <LoaderCircle className="animate-spin" />
            )}
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
