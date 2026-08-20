import { useMemo, useState } from "react"
import { Check, MoreHorizontal, Search, Trash2, Users } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { AssignableRole, Member, Role } from "./types"
import {
  formatRole,
  getOrganizationUserName,
  getRoleBadgeClasses,
} from "./types"

interface MembersTabProps {
  actorMembershipId: string
  actorRole: Role
  canChangeRoles: boolean
  canRemoveMembers: boolean
  isLoading: boolean
  members: Member[]
  onRemoveMember: (member: Member) => void
  onRoleChange: (member: Member, role: AssignableRole) => void
}

const assignableRoles: AssignableRole[] = ["ADMIN", "MEMBER", "VIEWER"]

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  )
}

function canManageTarget(actorRole: Role, target: Member) {
  if (target.role === "OWNER") return false
  if (actorRole === "ADMIN" && target.role === "ADMIN") return false
  return true
}

export function MembersTab({
  actorMembershipId,
  actorRole,
  canChangeRoles,
  canRemoveMembers,
  isLoading,
  members,
  onRemoveMember,
  onRoleChange,
}: MembersTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const itemsPerPage = 5
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const matchesSearch =
          getOrganizationUserName(member.user)
            .toLowerCase()
            .includes(normalizedSearch) ||
          member.user.email.toLowerCase().includes(normalizedSearch)
        return (
          matchesSearch && (roleFilter === "ALL" || member.role === roleFilter)
        )
      }),
    [members, normalizedSearch, roleFilter]
  )
  const totalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / itemsPerPage)
  )
  const visiblePage = Math.min(currentPage, totalPages)
  const startIndex = (visiblePage - 1) * itemsPerPage
  const visibleMembers = filteredMembers.slice(
    startIndex,
    startIndex + itemsPerPage
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 bg-card pl-9 text-sm"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setCurrentPage(1)
            }}
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value ?? "ALL")
            setCurrentPage(1)
          }}
        >
          <SelectTrigger className="h-9 w-full bg-card text-sm sm:w-[150px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value="OWNER">Owner</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MEMBER">Member</SelectItem>
            <SelectItem value="VIEWER">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {!isLoading && filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 rounded-full bg-secondary p-3">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-heading text-base font-semibold text-foreground">
                {members.length === 0 ? "No members yet" : "No members found"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {members.length === 0
                  ? "New members will appear here after joining."
                  : "Try a different search or role filter."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Skeleton className="h-8 w-52" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  : visibleMembers.map((member) => {
                      const name = getOrganizationUserName(member.user)
                      const isCurrentUser = member.id === actorMembershipId
                      const canManage =
                        !isCurrentUser && canManageTarget(actorRole, member)
                      const availableRoles =
                        actorRole === "OWNER"
                          ? assignableRoles
                          : assignableRoles.filter((role) => role !== "ADMIN")
                      const hasActions =
                        canManage && (canChangeRoles || canRemoveMembers)

                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-border">
                                <AvatarImage
                                  src={
                                    typeof member.user.avatarUrl === "string"
                                      ? member.user.avatarUrl
                                      : undefined
                                  }
                                  alt={name}
                                />
                                <AvatarFallback>
                                  {name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="block truncate text-sm font-medium text-foreground">
                                    {name}
                                  </span>
                                  {isCurrentUser && (
                                    <span className="rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {member.user.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getRoleBadgeClasses(member.role)}
                            >
                              {formatRole(member.role)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(member.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasActions ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  aria-label={`Manage ${name}`}
                                >
                                  <MoreHorizontal />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-44"
                                >
                                  {canChangeRoles &&
                                    availableRoles.map((role) => (
                                      <DropdownMenuItem
                                        key={role}
                                        disabled={member.role === role}
                                        className="justify-between"
                                        onClick={() =>
                                          onRoleChange(member, role)
                                        }
                                      >
                                        {formatRole(role)}
                                        {member.role === role && <Check />}
                                      </DropdownMenuItem>
                                    ))}
                                  {canChangeRoles && canRemoveMembers && (
                                    <DropdownMenuSeparator />
                                  )}
                                  {canRemoveMembers && (
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => setMemberToDelete(member)}
                                    >
                                      <Trash2 />
                                      Remove from team
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                -
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          )}

          {!isLoading && filteredMembers.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {startIndex + 1}-
                {Math.min(startIndex + itemsPerPage, filteredMembers.length)} of{" "}
                {filteredMembers.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={visiblePage === 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={visiblePage === totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(memberToDelete)}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member</DialogTitle>
            <DialogDescription>
              Remove{" "}
              {memberToDelete
                ? getOrganizationUserName(memberToDelete.user)
                : "this member"}
              ? They will immediately lose access to this organization.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (memberToDelete) onRemoveMember(memberToDelete)
                setMemberToDelete(null)
              }}
            >
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
