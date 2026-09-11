import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { configureApiAuth } from "@/api/api-client"
import { createQueryClient } from "@/api/query-client"
import { useAuthStore } from "@/stores/auth.store"
import { server } from "@/test/mocks/server"

import { TwoFactorCard } from "./TwoFactorCard"

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,cXJjb2Rl"),
  },
}))

const backupCodes = Array.from(
  { length: 10 },
  (_, index) => `CODE-${String(index + 1).padStart(4, "0")}`
)

function renderCard() {
  useAuthStore.getState().setSession({
    accessToken: "settings-access-token",
    expiresIn: 900,
    tokenType: "Bearer",
    user: {
      avatarUrl: null,
      displayName: "Secured User",
      email: "secured@example.com",
      emailVerified: true,
      id: "d3aef285-e012-4636-b739-c449695bf53b",
    },
  })
  configureApiAuth({
    clearSession: () => useAuthStore.getState().clearSession(),
    getAccessToken: () => useAuthStore.getState().accessToken,
  })

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/settings/profile"]}>
        <Routes>
          <Route path="/settings/profile" element={<TwoFactorCard />} />
          <Route path="/login" element={<div>Signed out login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => {
  useAuthStore.getState().clearSession()
  vi.clearAllMocks()
})

describe("TwoFactorCard", () => {
  it("completes setup and displays all single-view recovery codes", async () => {
    server.use(
      http.get(
        "http://localhost:3000/api/v1/auth/2fa/status",
        ({ request }) => {
          expect(request.headers.get("authorization")).toBe(
            "Bearer settings-access-token"
          )
          return HttpResponse.json({
            backupCodesRemaining: 0,
            enabled: false,
            setupPending: false,
          })
        }
      ),
      http.post("http://localhost:3000/api/v1/auth/2fa/setup", () =>
        HttpResponse.json({
          manualEntryKey: "JBSWY3DPEHPK3PXP",
          provisioningUri:
            "otpauth://totp/ShipFlow:secured@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ShipFlow",
        })
      ),
      http.post(
        "http://localhost:3000/api/v1/auth/2fa/setup/confirm",
        async ({ request }) => {
          expect(await request.json()).toEqual({ code: "123456" })
          return HttpResponse.json({ backupCodes, enabled: true })
        }
      )
    )
    const user = userEvent.setup()
    renderCard()

    await user.click(await screen.findByRole("button", { name: "Enable 2FA" }))

    expect(
      await screen.findByAltText(
        "QR code for adding ShipFlow to an authenticator app"
      )
    ).toBeVisible()
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeVisible()
    await user.type(screen.getByLabelText("Six-digit code"), "123456")
    await user.click(screen.getByRole("button", { name: "Verify and enable" }))

    expect(
      await screen.findByText("Save these recovery codes now")
    ).toBeVisible()
    for (const code of backupCodes) {
      expect(screen.getByText(code)).toBeVisible()
    }

    await user.click(
      screen.getByRole("button", { name: /I.ve saved these codes/ })
    )
    expect(await screen.findByText("Signed out login page")).toBeVisible()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it("requires step-up credentials before replacing recovery codes", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/auth/2fa/status", () =>
        HttpResponse.json({
          backupCodesRemaining: 7,
          enabled: true,
          setupPending: false,
        })
      ),
      http.post(
        "http://localhost:3000/api/v1/auth/2fa/backup-codes/regenerate",
        async ({ request }) => {
          expect(await request.json()).toEqual({
            code: "RECOVERY-1",
            currentPassword: "correct horse battery staple",
          })
          return HttpResponse.json({ backupCodes, enabled: true })
        }
      )
    )
    const user = userEvent.setup()
    renderCard()

    await user.click(
      await screen.findByRole("button", { name: "Replace recovery codes" })
    )
    await user.type(
      screen.getByLabelText("Current password"),
      "correct horse battery staple"
    )
    await user.type(
      screen.getByLabelText("Authenticator or recovery code"),
      "RECOVERY-1"
    )
    await user.click(screen.getByRole("button", { name: "Replace codes" }))

    expect(
      await screen.findByText("Save these recovery codes now")
    ).toBeVisible()
    expect(screen.getByText("CODE-0001")).toBeVisible()
    expect(screen.getByText("CODE-0010")).toBeVisible()
  })

  it("signs out after step-up verification disables two-factor auth", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/auth/2fa/status", () =>
        HttpResponse.json({
          backupCodesRemaining: 10,
          enabled: true,
          setupPending: false,
        })
      ),
      http.delete(
        "http://localhost:3000/api/v1/auth/2fa",
        async ({ request }) => {
          expect(await request.json()).toEqual({ code: "654321" })
          return HttpResponse.json({
            message: "Two-factor authentication disabled",
          })
        }
      )
    )
    const user = userEvent.setup()
    renderCard()

    await user.click(await screen.findByRole("button", { name: "Disable 2FA" }))
    await user.type(
      screen.getByLabelText("Authenticator or recovery code"),
      "654321"
    )
    await user.click(screen.getByRole("button", { name: "Disable 2FA" }))

    await waitFor(() =>
      expect(screen.getByText("Signed out login page")).toBeVisible()
    )
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})
