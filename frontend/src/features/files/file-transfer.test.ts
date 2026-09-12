import { afterEach, describe, expect, it, vi } from "vitest"

import type { FileUsageResponseDto } from "@/api/generated"

import {
  calculateSha256,
  resolveFileTransferUrl,
  uploadToSignedTarget,
  validateUploadFile,
} from "./file-transfer"

const availableUsage: FileUsageResponseDto = {
  maxBytes: 100 * 1024 * 1024,
  maxFiles: 100,
  usedBytes: 0,
  usedFiles: 0,
}

afterEach(() => vi.unstubAllGlobals())

describe("file transfer helpers", () => {
  it("validates accepted declarations and calculates SHA-256", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" })

    expect(validateUploadFile(file, availableUsage)).toBe("text/plain")
    expect(await calculateSha256(file)).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    )
  })

  it("rejects unsupported, oversized, and over-quota uploads", () => {
    expect(() =>
      validateUploadFile(new File(["<svg />"], "active.svg"), availableUsage)
    ).toThrow("Choose one of these file types")

    const oversized = new File(
      [new Uint8Array(25 * 1024 * 1024 + 1)],
      "large.pdf"
    )
    expect(() => validateUploadFile(oversized, availableUsage)).toThrow(
      "25 MiB or smaller"
    )

    expect(() =>
      validateUploadFile(new File(["hello"], "notes.txt"), {
        ...availableUsage,
        usedFiles: 100,
      })
    ).toThrow("exceed the workspace storage quota")
  })

  it("resolves API-relative targets and rejects unsafe protocols", () => {
    expect(
      resolveFileTransferUrl("/api/v1/file-content/file-id?signature=x")
    ).toBe("http://localhost:3000/api/v1/file-content/file-id?signature=x")
    expect(() => resolveFileTransferUrl("javascript:alert(1)")).toThrow(
      "destination is invalid"
    )
  })

  it("sends a raw file and required headers to a presigned PUT target", async () => {
    const listeners = new Map<string, () => void>()
    let sentBody: Document | XMLHttpRequestBodyInit | null = null
    const openRequest = vi.fn()
    const setHeader = vi.fn()

    class FakeXMLHttpRequest {
      status = 200
      upload = { addEventListener: vi.fn() }
      open = openRequest
      setRequestHeader = setHeader

      addEventListener(type: string, listener: EventListener) {
        listeners.set(type, () => listener(new Event(type)))
      }

      send(body: Document | XMLHttpRequestBodyInit | null) {
        sentBody = body
        queueMicrotask(() => listeners.get("load")?.())
      }

      abort() {}
    }

    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest)
    const file = new File(["hello"], "notes.txt", { type: "text/plain" })
    const transfer = uploadToSignedTarget(
      {
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        fields: {},
        headers: { "Content-Type": "text/plain" },
        method: "PUT",
        url: "https://storage.example/object?signature=test",
      },
      file,
      vi.fn()
    )

    await transfer.promise

    expect(sentBody).toBe(file)
    expect(openRequest).toHaveBeenCalledWith(
      "PUT",
      "https://storage.example/object?signature=test"
    )
    expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/plain")
  })
})
