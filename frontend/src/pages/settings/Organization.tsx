import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Building2,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"

import type {
  OrganizationListResponseDto,
  OrganizationResponseDto,
} from "@/api/generated"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatRole, getOrganizationUserName } from "@/components/team/types"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"
import { organizationApi } from "@/features/organizations/organization-api"
import { getOrganizationErrorMessage } from "@/features/organizations/organization-errors"
import {
  organizationKeys,
  useActiveOrganization,
  useOrganizationMembers,
} from "@/features/organizations/organization-queries"
import { clearActiveOrganizationData } from "@/features/organizations/organization-session"
import { recoverOrganizationAuthorization } from "@/features/organizations/organization-session"

function replaceOrganization(
  current: OrganizationListResponseDto | undefined,
  organization: OrganizationResponseDto
) {
  if (!current) return current
  return {
    ...current,
    items: current.items.map((item) =>
      item.id === organization.id ? organization : item
    ),
  }
}

export function OrganizationSettings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const organization = useActiveOrganization()
  const organizationId = organization?.id ?? null
  const canTransfer = hasOrganizationCapability(
    organization,
    "ownership:transfer"
  )
  const members = useOrganizationMembers(canTransfer ? organizationId : null)
  const [nameDraft, setNameDraft] = useState({
    organizationId: organization?.id ?? "",
    value: organization?.name ?? "",
  })
  const [selectedOwnerId, setSelectedOwnerId] = useState("")
  const [confirmation, setConfirmation] = useState<
    "delete" | "leave" | "transfer" | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  const handleActionError = (mutationError: unknown, fallback: string) => {
    setError(getOrganizationErrorMessage(mutationError, fallback))
    if (organizationId) {
      void recoverOrganizationAuthorization(
        mutationError,
        organizationId,
        queryClient
      )
    }
  }

  const applyOrganization = (updated: OrganizationResponseDto) => {
    queryClient.setQueryData<OrganizationListResponseDto>(
      organizationKeys.list,
      (current) => replaceOrganization(current, updated)
    )
    queryClient.setQueryData(organizationKeys.detail(updated.id), updated)
  }
  const exitOrganization = async () => {
    await clearActiveOrganizationData(queryClient)
    await queryClient.invalidateQueries({ queryKey: organizationKeys.list })
    navigate("/dashboard", { replace: true })
  }
  const renameOrganization = useMutation({
    mutationFn: ({ id, nextName }: { id: string; nextName: string }) =>
      organizationApi.update(id, { name: nextName }),
    onError: (mutationError) =>
      handleActionError(mutationError, "Unable to update the organization."),
    onSuccess: (updated) => applyOrganization(updated),
  })
  const leaveOrganization = useMutation({
    mutationFn: organizationApi.leave,
    onError: (mutationError) =>
      handleActionError(mutationError, "Unable to leave the organization."),
    onSuccess: () => void exitOrganization(),
  })
  const deleteOrganization = useMutation({
    mutationFn: organizationApi.delete,
    onError: (mutationError) =>
      handleActionError(mutationError, "Unable to delete the organization."),
    onSuccess: () => void exitOrganization(),
  })
  const transferOwnership = useMutation({
    mutationFn: ({ id, membershipId }: { id: string; membershipId: string }) =>
      organizationApi.transferOwnership(id, { membershipId }),
    onError: (mutationError) =>
      handleActionError(mutationError, "Unable to transfer ownership."),
    onSuccess: (updated) => {
      applyOrganization(updated)
      setSelectedOwnerId("")
      setConfirmation(null)
      void queryClient.invalidateQueries({
        queryKey: organizationKeys.members(updated.id),
      })
    },
  })

  if (!organization || !organizationId) return null

  const canUpdate = hasOrganizationCapability(
    organization,
    "organization:update"
  )
  const canDelete = hasOrganizationCapability(
    organization,
    "organization:delete"
  )
  const canLeave = hasOrganizationCapability(organization, "organization:leave")
  const transferCandidates =
    members.data?.items.filter(
      (member) => member.id !== organization.membershipId
    ) ?? []
  const selectedOwner = transferCandidates.find(
    (member) => member.id === selectedOwnerId
  )
  const name =
    nameDraft.organizationId === organizationId
      ? nameDraft.value
      : organization.name

  const handleRename = (event: FormEvent) => {
    event.preventDefault()
    const nextName = name.trim()
    if (nextName.length < 2 || nextName.length > 120) {
      setError("Use an organization name between 2 and 120 characters.")
      return
    }
    setError(null)
    renameOrganization.mutate({ id: organizationId, nextName })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Organization settings
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage the active organization and your membership.
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-4" onSubmit={handleRename}>
            <div className="space-y-2">
              <Label htmlFor="settings-organization-name">Name</Label>
              <Input
                id="settings-organization-name"
                value={name}
                disabled={!canUpdate}
                onChange={(event) =>
                  setNameDraft({
                    organizationId,
                    value: event.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                Workspace ID: {organization.id}
              </p>
              {canUpdate && (
                <Button
                  type="submit"
                  disabled={
                    renameOrganization.isPending ||
                    name.trim() === organization.name
                  }
                >
                  {renameOrganization.isPending && (
                    <LoaderCircle className="animate-spin" />
                  )}
                  Save changes
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck />
            Ownership and membership
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Your role</p>
              <p className="text-xs text-muted-foreground">
                Controls what you can manage in this organization.
              </p>
            </div>
            <Badge variant="outline">
              {formatRole(organization.currentUserRole)}
            </Badge>
          </div>

          {canTransfer && (
            <div className="space-y-3 border-t border-border pt-5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Transfer ownership
                </p>
                <p className="text-xs text-muted-foreground">
                  You will become an Admin after the transfer.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={selectedOwnerId}
                  onValueChange={(value) => setSelectedOwnerId(value ?? "")}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferCandidates.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {getOrganizationUserName(member.user)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={!selectedOwnerId}
                  onClick={() => setConfirmation("transfer")}
                >
                  Transfer ownership
                </Button>
              </div>
              {!members.isLoading && transferCandidates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Invite another member before transferring ownership.
                </p>
              )}
            </div>
          )}

          {canLeave && organization.currentUserRole !== "OWNER" && (
            <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Leave organization
                </p>
                <p className="text-xs text-muted-foreground">
                  Your access to this workspace will be removed.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setConfirmation("leave")}
              >
                <LogOut />
                Leave
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canDelete && (
        <Card className="border-danger/30">
          <CardHeader className="border-b border-danger/20">
            <CardTitle className="flex items-center gap-2 text-base text-danger">
              <Trash2 />
              Delete organization
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <p className="text-sm text-muted-foreground">
              Permanently remove access to this organization and revoke pending
              invitations.
            </p>
            <Button
              variant="destructive"
              onClick={() => setConfirmation("delete")}
            >
              Delete
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmation === "delete"
                ? "Delete organization"
                : confirmation === "leave"
                  ? "Leave organization"
                  : "Transfer ownership"}
            </DialogTitle>
            <DialogDescription>
              {confirmation === "delete"
                ? `Delete ${organization.name}? This action cannot be undone.`
                : confirmation === "leave"
                  ? `Leave ${organization.name}? You will lose access immediately.`
                  : `Transfer ownership to ${selectedOwner ? getOrganizationUserName(selectedOwner.user) : "this member"}? You will become an Admin.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmation === "transfer" ? "default" : "destructive"}
              disabled={
                leaveOrganization.isPending ||
                deleteOrganization.isPending ||
                transferOwnership.isPending
              }
              onClick={() => {
                setError(null)
                if (confirmation === "delete") {
                  deleteOrganization.mutate(organizationId)
                } else if (confirmation === "leave") {
                  leaveOrganization.mutate(organizationId)
                } else if (selectedOwnerId) {
                  transferOwnership.mutate({
                    id: organizationId,
                    membershipId: selectedOwnerId,
                  })
                }
              }}
            >
              {(leaveOrganization.isPending ||
                deleteOrganization.isPending ||
                transferOwnership.isPending) && (
                <LoaderCircle className="animate-spin" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
