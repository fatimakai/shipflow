import { render, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { server } from "@/test/mocks/server"

import { VerifyEmailPage } from "./VerifyEmailPage"

describe("VerifyEmailPage", () => {
  it("consumes the verification token and removes it from the route", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/v1/auth/email-verification/confirm",
        async ({ request }) => {
          expect(await request.json()).toEqual({ token: "v".repeat(32) })
          return HttpResponse.json({ message: "Email verified" })
        }
      )
    )

    render(
      <MemoryRouter initialEntries={[`/verify-email?token=${"v".repeat(32)}`]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText("Email verified")).toBeInTheDocument()
  })
})
