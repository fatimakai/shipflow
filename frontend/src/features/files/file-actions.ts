import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fileApi } from "./file-api"
import { fileKeys } from "./file-queries"
import { startFileDownload } from "./file-transfer"

export function useFileActions(organizationId: string) {
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: fileKeys.scope(organizationId) })

  const deleteFile = useMutation({
    mutationFn: (fileId: string) => fileApi.delete(organizationId, fileId),
    onSuccess: refresh,
  })
  const downloadFile = useMutation({
    mutationFn: async (file: { id: string; name: string }) => {
      const target = await fileApi.createDownloadTarget(organizationId, file.id)
      if (new Date(target.expiresAt).getTime() <= Date.now()) {
        throw new Error("The download link expired before it could be used.")
      }
      startFileDownload(target.url, file.name)
    },
  })
  const restoreFile = useMutation({
    mutationFn: (fileId: string) => fileApi.restore(organizationId, fileId),
    onSuccess: refresh,
  })

  return { deleteFile, downloadFile, restoreFile }
}
