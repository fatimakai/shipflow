import { BadgeCheck, Mail } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { getUserDisplayName, getUserInitials } from "@/features/auth/auth-user"
import { useAuthStore } from "@/stores/auth.store"

export function AvatarCard() {
  const user = useAuthStore((state) => state.user)

  if (!user) return null

  const displayName = getUserDisplayName(user)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-8 p-6 md:flex-row">
        <div className="space-y-1 md:w-1/3">
          <CardTitle>Account profile</CardTitle>
          <CardDescription>
            Your identity across ShipFlow workspaces.
          </CardDescription>
        </div>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start md:w-2/3">
          <Avatar className="h-24 w-24 shrink-0 border-2 border-border">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName} />
            <AvatarFallback className="text-xl">
              {getUserInitials(user)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                {displayName}
              </h2>
              {user.emailVerified && (
                <Badge className="border-success/20 bg-success/10 text-success hover:bg-success/10">
                  <BadgeCheck />
                  Verified
                </Badge>
              )}
            </div>
            <p className="flex min-w-0 items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
              <Mail className="shrink-0" />
              <span className="truncate">{user.email}</span>
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
