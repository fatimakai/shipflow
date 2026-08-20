import { apiClient } from "@/api/api-client"
import type {
  FileDownloadTargetResponseDto,
  FileListResponseDto,
  FileResponseDto,
  FileUploadReservationResponseDto,
  FileUsageResponseDto,
  InitiateFileUploadDto,
} from "@/api/generated"

import type { VisibleFileStatus } from "./file-constants"

function filesPath(organizationId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}/files`
}

export const fileApi = {
  completeUpload: (organizationId: string, fileId: string) =>
    apiClient.post<FileResponseDto>(
      `${filesPath(organizationId)}/${encodeURIComponent(fileId)}/complete`,
      { auth: true }
    ),
  createDownloadTarget: (organizationId: string, fileId: string) =>
    apiClient.get<FileDownloadTargetResponseDto>(
      `${filesPath(organizationId)}/${encodeURIComponent(fileId)}/download-url`,
      { auth: true }
    ),
  delete: (organizationId: string, fileId: string) =>
    apiClient.delete<FileResponseDto>(
      `${filesPath(organizationId)}/${encodeURIComponent(fileId)}`,
      { auth: true }
    ),
  initiateUpload: (organizationId: string, body: InitiateFileUploadDto) =>
    apiClient.post<FileUploadReservationResponseDto>(
      `${filesPath(organizationId)}/uploads`,
      { auth: true, json: body }
    ),
  list: (
    organizationId: string,
    options: { limit: number; page: number; status?: VisibleFileStatus }
  ) => {
    const query = new URLSearchParams({
      limit: String(options.limit),
      page: String(options.page),
    })
    if (options.status) query.set("status", options.status)

    return apiClient.get<FileListResponseDto>(
      `${filesPath(organizationId)}?${query.toString()}`,
      { auth: true }
    )
  },
  restore: (organizationId: string, fileId: string) =>
    apiClient.post<FileResponseDto>(
      `${filesPath(organizationId)}/${encodeURIComponent(fileId)}/restore`,
      { auth: true }
    ),
  usage: (organizationId: string) =>
    apiClient.get<FileUsageResponseDto>(`${filesPath(organizationId)}/usage`, {
      auth: true,
    }),
}
