import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Copy,
  KeyRound,
  Link2,
  Mail,
  Users,
  X,
} from "lucide-react"
import { useState } from "react"
import { useEffect } from "react"

import type { CreateInvitationDto } from "@/api/generated"
import { isApiError } from "@/api/api-error"
import { InviteMemberModal } from "@/components/team/InviteMemberModal"
import { MembersTab } from "@/components/team/MembersTab"
import { PendingInvitesTab } from "@/components/team/PendingInvitesTab"
import { TeamHeader } from "@/components/team/TeamHeader"
import { RolesPermissionsTab } from "@/components/team/RolesPermissionsTab"
import type {
  AssignableRole,
  Member,
  PendingInvite,
} from "@/components/team/types"
import { Button } from "@/components/ui/button"
import { env } from "@/config/env"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"
import { organizationApi } from "@/features/organizations/organization-api"
import { getOrganizationErrorMessage } from "@/features/organizations/organization-errors"
import {
  organizationKeys,
  useActiveOrganization,
  useOrganizationInvitations,
  useOrganizationMembers,
} from "@/features/organizations/organization-queries"
import { recoverOrganizationAuthorization } from "@/features/organizations/organization-session"

export function Team() {
  const queryClient = useQueryClient()
  const organization = useActiveOrganization()
  const organizationId = organization?.id ?? null
  const canReadInvitations = hasOrganizationCapability(
    organization,
    "invitation:read"
  )
  const members = useOrganizationMembers(organizationId)
  const invitations = useOrganizationInvitations(
    canReadInvitations ? organizationId : null
  )
  const [activeTab, setActiveTab] = useState("members")
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [inviteLinks, setInviteLinks] = useState<string[]>([])

  useEffect(() => {
    if (
      organizationId &&
      isApiError(members.error) &&
      (members.error.statusCode === 403 || members.error.statusCode === 404)
    ) {
      void recoverOrganizationAuthorization(
        members.error,
        organizationId,
        queryClient
      )
    }
  }, [members.error, organizationId, queryClient])

  const refreshMembers = (id: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(id) }),
      queryClient.invalidateQueries({ queryKey: organizationKeys.list }),
    ])
  const refreshInvitations = (id: string) =>
    queryClient.invalidateQueries({
      queryKey: organizationKeys.invitations(id),
    })
  const handleActionError = (error: unknown, fallback: string) => {
    setActionError(getOrganizationErrorMessage(error, fallback))
    if (organizationId) {
      void recoverOrganizationAuthorization(error, organizationId, queryClient)
    }
  }

  const updateRole = useMutation({
    mutationFn: ({
      member,
      role,
      tenantId,
    }: {
      member: Member
      role: AssignableRole
      tenantId: string
    }) => organizationApi.updateMemberRole(tenantId, member.id, { role }),
    onError: (error) =>
      handleActionError(error, "Unable to update the member role."),
    onSuccess: (_, variables) => void refreshMembers(variables.tenantId),
  })
  const removeMember = useMutation({
    mutationFn: ({ member, tenantId }: { member: Member; tenantId: string }) =>
      organizationApi.removeMember(tenantId, member.id),
    onError: (error) =>
      handleActionError(error, "Unable to remove the member."),
    onSuccess: (_, variables) => void refreshMembers(variables.tenantId),
  })
  const createInvitations = useMutation({
    mutationFn: ({
      invitations: invitationRequests,
      tenantId,
    }: {
      invitations: CreateInvitationDto[]
      tenantId: string
    }) =>
      Promise.all(
        invitationRequests.map((request) =>
          organizationApi.createInvitation(tenantId, request)
        )
      ),
    onError: (error) =>
      handleActionError(error, "Unable to create the invitation."),
    onSettled: (_, __, variables) =>
      void refreshInvitations(variables.tenantId),
    onSuccess: (created) => {
      setInviteLinks(
        created.flatMap((invitation) =>
          invitation.invitationUrl ? [invitation.invitationUrl] : []
        )
      )
      setIsInviteOpen(false)
      setActiveTab("invites")
    },
  })
  const resendInvitation = useMutation({
    mutationFn: ({
      invitation,
      tenantId,
    }: {
      invitation: PendingInvite
      tenantId: string
    }) => organizationApi.resendInvitation(tenantId, invitation.id),
    onError: (error) =>
      handleActionError(error, "Unable to rotate the invitation."),
    onSuccess: (invitation, variables) => {
      setInviteLinks(invitation.invitationUrl ? [invitation.invitationUrl] : [])
      void refreshInvitations(variables.tenantId)
    },
  })
  const revokeInvitation = useMutation({
    mutationFn: ({
      invitation,
      tenantId,
    }: {
      invitation: PendingInvite
      tenantId: string
    }) => organizationApi.revokeInvitation(tenantId, invitation.id),
    onError: (error) =>
      handleActionError(error, "Unable to revoke the invitation."),
    onSuccess: (_, variables) => void refreshInvitations(variables.tenantId),
  })

  if (!organization || !organizationId) return null

  const canInvite = hasOrganizationCapability(organization, "invitation:create")
  const canChangeRoles = hasOrganizationCapability(
    organization,
    "membership:change-role"
  )
  const canRemoveMembers = hasOrganizationCapability(
    organization,
    "membership:remove"
  )
  const queryError = members.isError
    ? getOrganizationErrorMessage(members.error, "Unable to load members.")
    : invitations.isError
      ? getOrganizationErrorMessage(
          invitations.error,
          "Unable to load invitations."
        )
      : null
  const displayedError = actionError ?? queryError

  return (
    <div className="space-y-6">
      <TeamHeader
        organizationName={organization.name}
        canInvite={canInvite}
        onOpenInvite={() => {
          setActionError(null)
          setIsInviteOpen(true)
        }}
      />

      {displayedError && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger/10 p-3.5 text-sm text-danger"
          role="alert"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{displayedError}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss error"
            onClick={() => setActionError(null)}
          >
            <X />
          </Button>
        </div>
      )}

      {inviteLinks.length > 0 && (
        <div
          className="rounded-lg border border-primary/20 bg-primary/5 p-4"
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Link2 className="h-4 w-4" />
                Shareable invitation{" "}
                {inviteLinks.length === 1 ? "link" : "links"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Copy and share securely. These links are displayed only after
                creation or rotation.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss invitation links"
              onClick={() => setInviteLinks([])}
            >
              <X />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {inviteLinks.map((link) => (
              <div key={link} className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-background px-2.5 py-2 text-xs">
                  {link}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(link)}
                >
                  <Copy />
                  Copy
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users />
            Members ({members.data?.pagination.total ?? 0})
          </TabsTrigger>
          {canReadInvitations && (
            <TabsTrigger value="invites" className="gap-2">
              <Mail />
              Pending invitations ({invitations.data?.pagination.total ?? 0})
            </TabsTrigger>
          )}
          <TabsTrigger value="permissions" className="gap-2">
            <KeyRound />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <MembersTab
            actorMembershipId={organization.membershipId}
            actorRole={organization.currentUserRole}
            canChangeRoles={canChangeRoles}
            canRemoveMembers={canRemoveMembers}
            members={members.data?.items ?? []}
            isLoading={members.isPending}
            onRoleChange={(member, role) => {
              setActionError(null)
              updateRole.mutate({ member, role, tenantId: organizationId })
            }}
            onRemoveMember={(member) => {
              setActionError(null)
              removeMember.mutate({ member, tenantId: organizationId })
            }}
          />
        </TabsContent>

        {canReadInvitations && (
          <TabsContent value="invites">
            <PendingInvitesTab
              canCreate={canInvite}
              canResend={hasOrganizationCapability(
                organization,
                "invitation:resend"
              )}
              canRevoke={hasOrganizationCapability(
                organization,
                "invitation:revoke"
              )}
              isLoading={invitations.isPending}
              pendingInvites={invitations.data?.items ?? []}
              onOpenInviteModal={() => setIsInviteOpen(true)}
              onResend={(invitation) =>
                resendInvitation.mutate({
                  invitation,
                  tenantId: organizationId,
                })
              }
              shareLinks={env.isPublicDemo}
              onRevoke={(invitation) =>
                revokeInvitation.mutate({
                  invitation,
                  tenantId: organizationId,
                })
              }
            />
          </TabsContent>
        )}
        <TabsContent value="permissions">
          <RolesPermissionsTab currentRole={organization.currentUserRole} />
        </TabsContent>
      </Tabs>

      {canInvite && (
        <InviteMemberModal
          actorRole={
            organization.currentUserRole === "OWNER" ? "OWNER" : "ADMIN"
          }
          error={createInvitations.isError ? actionError : null}
          isOpen={isInviteOpen}
          isPending={createInvitations.isPending}
          shareLinks={env.isPublicDemo}
          onClose={() => setIsInviteOpen(false)}
          onSubmit={(emails, role) => {
            setActionError(null)
            createInvitations.mutate({
              invitations: emails.map((email) => ({ email, role })),
              tenantId: organizationId,
            })
          }}
        />
      )}
    </div>
  )
}
