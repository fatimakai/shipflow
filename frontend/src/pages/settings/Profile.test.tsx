import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it } from "vitest"

import { createQueryClient } from "@/api/query-client"
import { useAuthStore } from "@/stores/auth.store"
import { server } from "@/test/mocks/server"

import { Profile } from "./Profile"

const initialUser = {
  avatarUrl: null,
  displayName: "Alex Morgan",
  email: "alex@example.com",
  emailVerified: true,
  id: "11111111-1111-4111-8111-111111111111",
}

function renderProfile() {
  useAuthStore.getState().setUser(initialUser)
  return render(
    <MemoryRouter initialEntries={["/settings/profile"]}>
      <QueryClientProvider client={createQueryClient()}>
        <Profile />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

afterEach(() => useAuthStore.getState().clearSession())

describe("Profile", () => {
  it("updates the backend profile and shared auth user", async () => {
    server.use(
      http.patch(
        "http://localhost:3000/api/v1/auth/me",
        async ({ request }) => {
          const body = (await request.json()) as { displayName: string }
          return HttpResponse.json({
            ...initialUser,
            displayName: body.displayName,
          })
        }
      )
    )
    const user = userEvent.setup()

    renderProfile()
    const displayName = screen.getByLabelText("Display name")
    await user.clear(displayName)
    await user.type(displayName, "Sam Rivera")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() =>
      expect(useAuthStore.getState().user?.displayName).toBe("Sam Rivera")
    )
    expect(screen.getByText("Sam Rivera")).toBeVisible()
  })

  it("rejects an empty display name before making a request", async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.clear(screen.getByLabelText("Display name"))
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(
      screen.getByText("Use a display name between 1 and 100 characters.")
    ).toBeVisible()
  })
})
