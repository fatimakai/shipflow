import type {
  InvitationResponseDto,
  MembershipResponseDto,
} from "@/api/generated"

export type Role = MembershipResponseDto["role"]
export type AssignableRole = Exclude<Role, "OWNER">
export type Member = MembershipResponseDto
export type PendingInvite = InvitationResponseDto

export function formatRole(role: Role) {
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export function getOrganizationUserName(user: Member["user"]) {
  const displayName: unknown = user.displayName
  return typeof displayName === "string" && displayName.trim()
    ? displayName
    : user.email
}

export function getRoleBadgeClasses(role: Role) {
  switch (role) {
    case "OWNER":
      return "border-primary/20 bg-primary/10 text-primary"
    case "ADMIN":
      return "border-warning/20 bg-warning/10 text-warning"
    case "MEMBER":
      return "border-success/20 bg-success/10 text-success"
    case "VIEWER":
      return "border-border bg-secondary text-muted-foreground"
  }
}
