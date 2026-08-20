import { describe, expect, it } from "vitest"

import { getHostedBillingUrl } from "./billing-redirect"

describe("getHostedBillingUrl", () => {
  it("allows secure hosted provider URLs", () => {
    expect(
      getHostedBillingUrl(
        "https://checkout.stripe.com/c/pay/cs_test_123",
        "https://app.example.com"
      )
    ).toBe("https://checkout.stripe.com/c/pay/cs_test_123")
  })

  it("allows local HTTP returns for the stub provider", () => {
    expect(
      getHostedBillingUrl("/billing?checkout=success", "http://localhost:5173")
    ).toBe("http://localhost:5173/billing?checkout=success")
  })

  it("rejects insecure external and executable URLs", () => {
    expect(() =>
      getHostedBillingUrl(
        "http://checkout.example.com/session",
        "http://localhost:5173"
      )
    ).toThrow("unsafe redirect URL")
    expect(() =>
      getHostedBillingUrl("javascript:alert(1)", "http://localhost:5173")
    ).toThrow("unsafe redirect URL")
  })
})
