import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useOrganizationStore } from "@/stores/organization.store"

import {
  useActiveOrganization,
  useOrganizations,
} from "../organization-queries"
import { activateOrganization } from "../organization-session"
import { CreateOrganizationDialog } from "./CreateOrganizationDialog"

function organizationInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "N"
}

export function OrganizationSwitcher() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const activeOrganization = useActiveOrganization()
  const organizations = useOrganizations()
  const activeOrganizationId = useOrganizationStore(
    (state) => state.activeOrganizationId
  )

  if (!activeOrganization) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Switch organization"
          className="flex w-full cursor-pointer items-center justify-between rounded-sm border border-sidebar-border bg-sidebar-accent px-3 py-2.5 text-sm font-medium transition-colors hover:border-sidebar-primary/60"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {organizationInitial(activeOrganization.name)}
            </div>
            <div className="min-w-0 text-left">
              <span className="block truncate text-sm text-sidebar-foreground">
                {activeOrganization.name}
              </span>
              <span className="block text-xs capitalize text-sidebar-foreground/60">
                {activeOrganization.currentUserRole.toLowerCase()}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[208px]" align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            {organizations.data?.items.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                className="justify-between py-2"
                onClick={() =>
                  void activateOrganization(organization.id, queryClient)
                }
              >
                <span className="truncate">{organization.name}</span>
                {organization.id === activeOrganizationId && (
                  <Check className="text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/settings/organization")}>
            <Settings />
            Organization settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
            <Plus />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateOrganizationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </>
  )
}
