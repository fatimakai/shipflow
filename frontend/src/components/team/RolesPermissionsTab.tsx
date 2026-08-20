import { Check, Minus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  OrganizationCapability,
  OrganizationRole,
} from "@/features/organizations/organization-capabilities"
import { roleHasOrganizationCapability } from "@/features/organizations/organization-capabilities"

import { formatRole } from "./types"

const roles: OrganizationRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"]
const permissionRows: Array<{
  capability: OrganizationCapability
  label: string
}> = [
  { capability: "organization:read", label: "View organization" },
  { capability: "organization:update", label: "Edit organization" },
  { capability: "organization:delete", label: "Delete organization" },
  { capability: "membership:read", label: "View team members" },
  { capability: "membership:change-role", label: "Change member roles" },
  { capability: "invitation:create", label: "Invite team members" },
  { capability: "billing:read", label: "View billing" },
  { capability: "billing:manage", label: "Manage billing" },
  { capability: "notification:manage", label: "Manage notifications" },
  { capability: "file:read", label: "View files" },
  { capability: "file:upload", label: "Upload files" },
  { capability: "file:delete", label: "Delete files" },
]

export function RolesPermissionsTab({
  currentRole,
}: {
  currentRole: OrganizationRole
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Roles and permissions</CardTitle>
        <CardDescription>
          A summary of the organization access assigned to each role.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="min-w-48">Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role} className="min-w-24 text-center">
                  <span>{formatRole(role)}</span>
                  {role === currentRole && (
                    <Badge
                      className="ml-1.5 px-1.5 py-0 text-[10px]"
                      variant="outline"
                    >
                      You
                    </Badge>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissionRows.map((item) => (
              <TableRow key={item.capability}>
                <TableCell className="text-sm font-medium text-foreground">
                  {item.label}
                </TableCell>
                {roles.map((role) => (
                  <TableCell key={role} className="text-center">
                    {roleHasOrganizationCapability(role, item.capability) ? (
                      <Check
                        className="mx-auto h-4 w-4 text-success"
                        aria-label="Allowed"
                      />
                    ) : (
                      <Minus
                        className="mx-auto h-4 w-4 text-muted-foreground/40"
                        aria-label="Not allowed"
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
