import type { LucideIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { isApiError } from "@/api/api-error"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatRole,
  getOrganizationUserName,
  getRoleBadgeClasses,
  type Role,
} from "@/components/team/types"
import {
  useDashboardBilling,
  useDashboardFileUsage,
  useDashboardUnreadNotifications,
} from "@/features/dashboard/dashboard-queries"
import { formatBytes } from "@/features/files/file-format"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"
import {
  useActiveOrganization,
  useOrganizationMembers,
} from "@/features/organizations/organization-queries"
import { recoverOrganizationAuthorization } from "@/features/organizations/organization-session"

const ITEMS_PER_PAGE = 5
const ROLE_ORDER: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"]

interface MetricCardProps {
  description: string
  error?: boolean
  icon: LucideIcon
  label: string
  loading?: boolean
  onRetry?: () => void
  value: string
}

function MetricCard({
  description,
  error = false,
  icon: Icon,
  label,
  loading = false,
  onRetry,
  value,
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {label}
          </p>
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        {loading ? (
          <Skeleton className="mb-2 h-8 w-24" />
        ) : (
          <p className="font-heading text-2xl font-semibold text-foreground">
            {error ? "Unavailable" : value}
          </p>
        )}
        <div className="mt-1.5 flex min-h-5 items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {error ? "This data could not be loaded." : description}
          </p>
          {error && onRetry && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRetry}
              aria-label={`Retry ${label.toLowerCase()}`}
              title={`Retry ${label.toLowerCase()}`}
            >
              <RefreshCw />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatBillingStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function Dashboard() {
  const queryClient = useQueryClient()
  const organization = useActiveOrganization()
  const organizationId = organization?.id ?? null
  const canReadFiles = hasOrganizationCapability(organization, "file:read")
  const canReadBilling = hasOrganizationCapability(organization, "billing:read")
  const canReadNotifications = hasOrganizationCapability(
    organization,
    "notification:read"
  )
  const members = useOrganizationMembers(organizationId)
  const fileUsage = useDashboardFileUsage(organizationId, canReadFiles)
  const billing = useDashboardBilling(organizationId, canReadBilling)
  const unreadNotifications = useDashboardUnreadNotifications(
    organizationId,
    canReadNotifications
  )
  const [pagination, setPagination] = useState({
    organizationId,
    page: 1,
  })
  const currentPage =
    pagination.organizationId === organizationId ? pagination.page : 1

  useEffect(() => {
    if (!organizationId) return

    const authorizationError = [
      members.error,
      fileUsage.error,
      billing.error,
      unreadNotifications.error,
    ].find(
      (error) =>
        isApiError(error) &&
        (error.statusCode === 403 || error.statusCode === 404)
    )

    if (authorizationError) {
      void recoverOrganizationAuthorization(
        authorizationError,
        organizationId,
        queryClient
      )
    }
  }, [
    billing.error,
    fileUsage.error,
    members.error,
    organizationId,
    queryClient,
    unreadNotifications.error,
  ])

  const sortedMembers = useMemo(
    () =>
      [...(members.data?.items ?? [])].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      ),
    [members.data?.items]
  )
  const totalPages = Math.max(
    1,
    Math.ceil(sortedMembers.length / ITEMS_PER_PAGE)
  )
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE
  const paginatedMembers = sortedMembers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  )
  const roleCounts = ROLE_ORDER.map((role) => ({
    count: sortedMembers.filter((member) => member.role === role).length,
    role,
  })).filter(({ count }) => count > 0)
  const storagePercentage = fileUsage.data
    ? fileUsage.data.maxBytes > 0
      ? Math.min(
          100,
          Math.round((fileUsage.data.usedBytes / fileUsage.data.maxBytes) * 100)
        )
      : 0
    : 0

  if (!organization) return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {organization.name}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          An overview of your active workspace.
        </p>
      </div>

      <div
        className={
          canReadBilling
            ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
            : "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        }
      >
        <MetricCard
          description="People in this workspace"
          icon={Users}
          label="Members"
          value={String(organization.memberCount)}
        />
        <MetricCard
          description="Your workspace access level"
          icon={ShieldCheck}
          label="Your role"
          value={formatRole(organization.currentUserRole)}
        />
        {canReadFiles && (
          <MetricCard
            description={
              fileUsage.data
                ? `${fileUsage.data.usedFiles} of ${fileUsage.data.maxFiles} files`
                : "Workspace file storage"
            }
            error={fileUsage.isError}
            icon={Database}
            label="Storage used"
            loading={fileUsage.isPending}
            onRetry={() => void fileUsage.refetch()}
            value={formatBytes(fileUsage.data?.usedBytes ?? 0)}
          />
        )}
        {canReadNotifications && (
          <MetricCard
            description="Unread in this workspace"
            error={unreadNotifications.isError}
            icon={Bell}
            label="Notifications"
            loading={unreadNotifications.isPending}
            onRetry={() => void unreadNotifications.refetch()}
            value={String(unreadNotifications.data?.count ?? 0)}
          />
        )}
        {canReadBilling && (
          <MetricCard
            description={
              billing.data?.subscriptionStatus
                ? formatBillingStatus(billing.data.subscriptionStatus)
                : "Current workspace plan"
            }
            error={billing.isError}
            icon={CreditCard}
            label="Plan"
            loading={billing.isPending}
            onRetry={() => void billing.refetch()}
            value={billing.data?.plan.name ?? "Free"}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {canReadFiles && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <div>
                <CardTitle className="text-base">Storage</CardTitle>
                <CardDescription>
                  Organization file usage and quota
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {fileUsage.isPending ? (
                <div className="space-y-4" aria-label="Loading storage usage">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-5 w-56" />
                </div>
              ) : fileUsage.isError ? (
                <div className="flex min-h-24 items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Storage usage is temporarily unavailable.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void fileUsage.refetch()}
                  >
                    <RefreshCw />
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    className="h-3 overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-label="Storage quota used"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={storagePercentage}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${storagePercentage}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-foreground">
                      {formatBytes(fileUsage.data?.usedBytes ?? 0)} used
                    </span>
                    <span className="text-muted-foreground">
                      {formatBytes(fileUsage.data?.maxBytes ?? 0)} total
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className={canReadFiles ? "lg:col-span-2" : "lg:col-span-5"}>
          <CardHeader>
            <div>
              <CardTitle className="text-base">Team composition</CardTitle>
              <CardDescription>Members by assigned role</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {members.isPending ? (
              <div className="space-y-3" aria-label="Loading team composition">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-4/5" />
                <Skeleton className="h-7 w-3/5" />
              </div>
            ) : members.isError ? (
              <div className="flex min-h-24 items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Team data is temporarily unavailable.
                </p>
                <Button
                  variant="outline"
                  onClick={() => void members.refetch()}
                >
                  <RefreshCw />
                  Retry
                </Button>
              </div>
            ) : roleCounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No team members found.
              </p>
            ) : (
              <div className="space-y-3">
                {roleCounts.map(({ count, role }) => (
                  <div
                    key={role}
                    className="flex items-center justify-between gap-4"
                  >
                    <Badge
                      variant="outline"
                      className={getRoleBadgeClasses(role)}
                    >
                      {formatRole(role)}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <div>
            <CardTitle className="text-base">Recent team members</CardTitle>
            <CardDescription>
              {members.data
                ? `${members.data.pagination.total} members total`
                : "People with workspace access"}
            </CardDescription>
          </div>
          <CardAction>
            <Button
              nativeButton={false}
              variant="ghost"
              size="sm"
              render={<Link to="/team" />}
            >
              View team
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.isPending &&
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {members.isError && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-28 text-center">
                      <p className="mb-3 text-sm text-muted-foreground">
                        Team members could not be loaded.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void members.refetch()}
                      >
                        <RefreshCw />
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
                {!members.isPending &&
                  !members.isError &&
                  paginatedMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-28 text-center">
                        No members found.
                      </TableCell>
                    </TableRow>
                  )}
                {paginatedMembers.map((member) => {
                  const name = getOrganizationUserName(member.user)
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex min-w-56 items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={member.user.avatarUrl ?? undefined}
                              alt={name}
                            />
                            <AvatarFallback>
                              {name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.user.email}
                            </p>
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
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(member.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {!members.isPending &&
            !members.isError &&
            sortedMembers.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {startIndex + 1}-
                  {Math.min(startIndex + ITEMS_PER_PAGE, sortedMembers.length)}{" "}
                  of {sortedMembers.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={safePage === 1}
                    onClick={() =>
                      setPagination({
                        organizationId,
                        page: Math.max(1, safePage - 1),
                      })
                    }
                    aria-label="Previous members page"
                    title="Previous page"
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="min-w-16 text-center text-xs text-muted-foreground">
                    {safePage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={safePage === totalPages}
                    onClick={() =>
                      setPagination({
                        organizationId,
                        page: Math.min(totalPages, safePage + 1),
                      })
                    }
                    aria-label="Next members page"
                    title="Next page"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  )
}
