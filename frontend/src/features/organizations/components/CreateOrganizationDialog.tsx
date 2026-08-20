import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { useState, type FormEvent } from "react"

import type {
  OrganizationListResponseDto,
  OrganizationResponseDto,
} from "@/api/generated"
import { Button } from "@/components/ui/button"
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

import { organizationApi } from "../organization-api"
import { getOrganizationErrorMessage } from "../organization-errors"
import { organizationKeys } from "../organization-queries"
import { activateOrganization } from "../organization-session"

interface CreateOrganizationDialogProps {
  onOpenChange: (open: boolean) => void
  open: boolean
}

function addOrganizationToList(
  current: OrganizationListResponseDto | undefined,
  organization: OrganizationResponseDto
): OrganizationListResponseDto {
  if (!current) {
    return {
      items: [organization],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }
  }

  return {
    ...current,
    items: [organization, ...current.items],
    pagination: {
      ...current.pagination,
      total: current.pagination.total + 1,
      totalPages: Math.max(1, current.pagination.totalPages),
    },
  }
}

export function CreateOrganizationDialog({
  onOpenChange,
  open,
}: CreateOrganizationDialogProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const createOrganization = useMutation({
    mutationFn: organizationApi.create,
    onSuccess: async (organization) => {
      queryClient.setQueryData<OrganizationListResponseDto>(
        organizationKeys.list,
        (current) => addOrganizationToList(current, organization)
      )
      await activateOrganization(organization.id, queryClient)
      setName("")
      onOpenChange(false)
    },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setName("")
      setValidationError(null)
      createOrganization.reset()
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const normalizedName = name.trim()

    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setValidationError(
        "Use an organization name between 2 and 120 characters."
      )
      return
    }

    setValidationError(null)
    createOrganization.mutate({ name: normalizedName })
  }

  const error =
    validationError ??
    (createOrganization.isError
      ? getOrganizationErrorMessage(
          createOrganization.error,
          "Unable to create the organization."
        )
      : null)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Create a separate workspace for a team, client, or business.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="organization-name">Organization name</Label>
            <Input
              id="organization-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setValidationError(null)
              }}
              autoComplete="organization"
              autoFocus
              aria-invalid={Boolean(error)}
              placeholder="Acme Operations"
            />
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createOrganization.isPending}>
              {createOrganization.isPending && (
                <LoaderCircle className="animate-spin" />
              )}
              Create organization
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
