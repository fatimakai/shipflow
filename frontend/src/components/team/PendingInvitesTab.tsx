import { Mail, UserPlus } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { PendingInvite } from "./types"
import {
  formatRole,
  getOrganizationUserName,
  getRoleBadgeClasses,
} from "./types"

interface PendingInvitesTabProps {
  canCreate: boolean
  canResend: boolean
  canRevoke: boolean
  isLoading: boolean
  onOpenInviteModal: () => void
  onResend: (invite: PendingInvite) => void
  onRevoke: (invite: PendingInvite) => void
  pendingInvites: PendingInvite[]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  )
}

export function PendingInvitesTab({
  canCreate,
  canResend,
  canRevoke,
  isLoading,
  onOpenInviteModal,
  onResend,
  onRevoke,
  pendingInvites,
}: PendingInvitesTabProps) {
  const [inviteToRevoke, setInviteToRevoke] = useState<PendingInvite | null>(
    null
  )

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {!isLoading && pendingInvites.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-3 rounded-full bg-secondary p-3 text-muted-foreground">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-base font-semibold text-foreground">
                No pending invitations
              </h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Invitations appear here until they are accepted, revoked, or
                expire.
              </p>
              {canCreate && (
                <Button className="mt-4" onClick={onOpenInviteModal}>
                  <UserPlus />
                  Invite member
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited by</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Skeleton className="h-4 w-44" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  : pendingInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="text-sm font-medium text-foreground">
                          {invite.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getRoleBadgeClasses(invite.role)}
                          >
                            {formatRole(invite.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getOrganizationUserName(invite.invitedBy)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(invite.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(invite.expiresAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canResend && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onResend(invite)}
                              >
                                Resend
                              </Button>
                            )}
                            {canRevoke && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-danger hover:bg-danger/10 hover:text-danger"
                                onClick={() => setInviteToRevoke(invite)}
                              >
                                Revoke
                              </Button>
                            )}
                            {!canResend && !canRevoke && (
                              <span className="text-xs text-muted-foreground">
                                -
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(inviteToRevoke)}
        onOpenChange={(open) => !open && setInviteToRevoke(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invitation</DialogTitle>
            <DialogDescription>
              Revoke the invitation for {inviteToRevoke?.email}? Its invitation
              link will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteToRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (inviteToRevoke) onRevoke(inviteToRevoke)
                setInviteToRevoke(null)
              }}
            >
              Revoke invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
