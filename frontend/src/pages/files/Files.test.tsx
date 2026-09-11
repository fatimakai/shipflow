import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  FileResponseDto,
  OrganizationListResponseDto,
} from "@/api/generated"
import { createQueryClient } from "@/api/query-client"
import { organizationKeys } from "@/features/organizations/organization-queries"
import { useOrganizationStore } from "@/stores/organization.store"
import { server } from "@/test/mocks/server"

vi.mock("@/features/files/file-transfer", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/files/file-transfer")>()
  return {
    ...actual,
    calculateSha256: vi.fn(async () => "a".repeat(64)),
    startFileDownload: vi.fn(),
    uploadToSignedTarget: vi.fn(
      (
        _target: unknown,
        _file: File,
        onProgress: (progress: number) => void
      ) => {
        onProgress(100)
        return { cancel: vi.fn(), promise: Promise.resolve() }
      }
    ),
  }
})

import {
  startFileDownload,
  uploadToSignedTarget,
} from "@/features/files/file-transfer"

import { Files } from "./Files"

const organizationId = "11111111-1111-4111-8111-111111111111"
const filesUrl = `http://localhost:3000/api/v1/organizations/${organizationId}/files`
const activeTransferExpiry = () =>
  new Date(Date.now() + 10 * 60 * 1000).toISOString()

const readyFile: FileResponseDto = {
  createdAt: "2026-08-13T10:00:00.000Z",
  deletedAt: null,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  malwareStatus: "NOT_REQUIRED",
  mimeType: "application/pdf",
  organizationId,
  originalName: "quarterly-report.pdf",
  sizeBytes: 2048,
  status: "READY",
  storageProvider: "LOCAL",
  uploadedAt: "2026-08-13T10:01:00.000Z",
  uploadedBy: { displayName: "Alex Morgan", id: "user-1" },
}

const deletedFile: FileResponseDto = {
  ...readyFile,
  deletedAt: "2026-08-13T12:00:00.000Z",
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  originalName: "deleted-report.pdf",
  status: "DELETED",
}

function renderFiles(
  capabilities: OrganizationListResponseDto["items"][number]["currentUserCapabilities"] = [
    "organization:read",
    "file:read",
    "file:upload",
    "file:delete",
  ]
) {
  const queryClient = createQueryClient()
  queryClient.setQueryData<OrganizationListResponseDto>(organizationKeys.list, {
    items: [
      {
        createdAt: "2026-08-01T00:00:00.000Z",
        currentUserCapabilities: capabilities,
        currentUserRole: capabilities.includes("file:upload")
          ? "MEMBER"
          : "VIEWER",
        id: organizationId,
        memberCount: 2,
        membershipId: "22222222-2222-4222-8222-222222222222",
        name: "Northstar Labs",
        owner: {
          avatarUrl: null,
          displayName: "Alex Morgan",
          email: "alex@example.com",
          id: "user-1",
        },
        ownerId: "user-1",
        slug: "northstar-labs",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    pagination: { limit: 100, page: 1, total: 1, totalPages: 1 },
  })
  useOrganizationStore.getState().setActiveOrganization(organizationId)

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Files />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

function useFileHandlers() {
  server.use(
    http.get(`${filesUrl}/usage`, () =>
      HttpResponse.json({
        maxBytes: 100 * 1024 * 1024,
        maxFiles: 100,
        usedBytes: 2048,
        usedFiles: 1,
      })
    ),
    http.get(filesUrl, ({ request }) => {
      const status = new URL(request.url).searchParams.get("status")
      const items = status === "DELETED" ? [deletedFile] : [readyFile]
      return HttpResponse.json({
        items,
        pagination: { limit: 20, page: 1, total: 1, totalPages: 1 },
      })
    })
  )
}

afterEach(() => {
  useOrganizationStore.getState().clearActiveOrganization()
  vi.clearAllMocks()
})

describe("Files", () => {
  it("shows workspace files and keeps viewer controls read-only", async () => {
    useFileHandlers()
    renderFiles(["organization:read", "file:read"])

    expect(await screen.findByText("quarterly-report.pdf")).toBeVisible()
    expect(screen.getByText("2.0 KB of 100 MB used")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Download quarterly-report.pdf" })
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Upload file" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Delete quarterly-report.pdf" })
    ).not.toBeInTheDocument()
  })

  it("reserves, transfers, and finalizes an upload", async () => {
    useFileHandlers()
    let reservationBody: unknown
    let completedFileId: string | undefined
    server.use(
      http.post(`${filesUrl}/uploads`, async ({ request }) => {
        reservationBody = await request.json()
        return HttpResponse.json(
          {
            file: { ...readyFile, id: "upload-file", status: "PENDING" },
            upload: {
              expiresAt: activeTransferExpiry(),
              fields: { token: "signed-field" },
              fileField: "file",
              method: "POST",
              url: "https://storage.example/upload",
            },
          },
          { status: 201 }
        )
      }),
      http.post(`${filesUrl}/:fileId/complete`, ({ params }) => {
        completedFileId = String(params.fileId)
        return HttpResponse.json(readyFile)
      })
    )
    const user = userEvent.setup()
    renderFiles()

    await user.click(await screen.findByRole("button", { name: "Upload file" }))
    await user.upload(
      screen.getByLabelText("Select file to upload"),
      new File(["hello"], "notes.txt", { type: "text/plain" })
    )

    expect(await screen.findByText(/Upload complete/)).toBeVisible()
    expect(reservationBody).toEqual({
      checksumSha256: "a".repeat(64),
      fileName: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
    })
    expect(uploadToSignedTarget).toHaveBeenCalledOnce()
    expect(completedFileId).toBe("upload-file")
  })

  it("downloads, deletes, filters, and restores files", async () => {
    useFileHandlers()
    let deletedId: string | undefined
    let restoredId: string | undefined
    server.use(
      http.get(`${filesUrl}/:fileId/download-url`, () =>
        HttpResponse.json({
          expiresAt: activeTransferExpiry(),
          method: "GET",
          url: "/api/v1/file-content/download",
        })
      ),
      http.delete(`${filesUrl}/:fileId`, ({ params }) => {
        deletedId = String(params.fileId)
        return HttpResponse.json({ ...readyFile, status: "DELETED" })
      }),
      http.post(`${filesUrl}/:fileId/restore`, ({ params }) => {
        restoredId = String(params.fileId)
        return HttpResponse.json(readyFile)
      })
    )
    const user = userEvent.setup()
    renderFiles()

    await user.click(
      await screen.findByRole("button", {
        name: "Download quarterly-report.pdf",
      })
    )
    await waitFor(() =>
      expect(startFileDownload).toHaveBeenCalledWith(
        "/api/v1/file-content/download",
        "quarterly-report.pdf"
      )
    )

    await user.click(
      screen.getByRole("button", { name: "Delete quarterly-report.pdf" })
    )
    await user.click(screen.getByRole("button", { name: "Delete file" }))
    await waitFor(() => expect(deletedId).toBe(readyFile.id))

    await user.click(
      screen.getByRole("combobox", { name: "Filter files by status" })
    )
    await user.click(screen.getByRole("option", { name: "Deleted" }))
    await user.click(
      await screen.findByRole("button", { name: "Restore deleted-report.pdf" })
    )
    await waitFor(() => expect(restoredId).toBe(deletedFile.id))
  })
})
