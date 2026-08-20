import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createQueryClient } from "@/api/query-client"

import { ApiHealthIndicator } from "./ApiHealthIndicator"

describe("ApiHealthIndicator", () => {
  it("shows when the API is ready", async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ApiHealthIndicator />
      </QueryClientProvider>
    )

    expect(await screen.findByText("API connected")).toBeInTheDocument()
  })
})
