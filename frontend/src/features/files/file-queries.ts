import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { organizationKeys } from "@/features/organizations/organization-queries"

import { fileApi } from "./file-api"
import { FILE_PAGE_SIZE, type VisibleFileStatus } from "./file-constants"

export const fileKeys = {
  list: (organizationId: string, page: number, status?: VisibleFileStatus) =>
    [
      ...organizationKeys.scope(organizationId),
      "files",
      "list",
      { page, status: status ?? "ACTIVE" },
    ] as const,
  scope: (organizationId: string) =>
    [...organizationKeys.scope(organizationId), "files"] as const,
  usage: (organizationId: string) =>
    [...organizationKeys.scope(organizationId), "files", "usage"] as const,
}

export function useFiles(
  organizationId: string | null,
  options: {
    enabled?: boolean
    isVisible?: boolean
    page?: number
    status?: VisibleFileStatus
  } = {}
) {
  const page = options.page ?? 1

  return useQuery({
    enabled: Boolean(organizationId) && (options.enabled ?? true),
    queryKey: organizationId
      ? fileKeys.list(organizationId, page, options.status)
      : ["organization", "none", "files", "list"],
    queryFn: () =>
      fileApi.list(organizationId!, {
        limit: FILE_PAGE_SIZE,
        page,
        status: options.status,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      if (options.isVisible === false) return false
      const hasProcessingFile = query.state.data?.items.some(
        (file) => file.status === "PENDING" || file.status === "SCANNING"
      )
      return hasProcessingFile ? 5_000 : false
    },
    refetchOnWindowFocus: true,
  })
}

export function useFileUsage(
  organizationId: string | null,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    enabled: Boolean(organizationId) && (options.enabled ?? true),
    queryKey: organizationId
      ? fileKeys.usage(organizationId)
      : ["organization", "none", "files", "usage"],
    queryFn: () => fileApi.usage(organizationId!),
  })
}
