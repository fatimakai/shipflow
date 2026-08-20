import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TeamHeaderProps {
  canInvite: boolean
  organizationName: string
  onOpenInvite: () => void
}

export function TeamHeader({
  canInvite,
  organizationName,
  onOpenInvite,
}: TeamHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Team
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage members and invitations for {organizationName}.
        </p>
      </div>

      {canInvite && (
        <Button onClick={onOpenInvite} className="self-start sm:self-auto">
          <UserPlus />
          Invite member
        </Button>
      )}
    </div>
  )
}
