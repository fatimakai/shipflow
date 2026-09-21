import { afterEach, describe, expect, it } from "vitest"

import {
  consumeAuthReturnPath,
  rememberAuthReturnPath,
} from "./auth-return-path"

afterEach(() => sessionStorage.clear())

describe("OAuth return paths", () => {
  it("preserves an internal invitation path for the OAuth round trip", () => {
    rememberAuthReturnPath({
      pathname: "/invitations/accept",
      search: "?token=single-use-token",
    })

    expect(consumeAuthReturnPath()).toBe(
      "/invitations/accept?token=single-use-token"
    )
    expect(sessionStorage).toHaveLength(0)
  })

  it("rejects protocol-relative and backslash return paths", () => {
    rememberAuthReturnPath({ pathname: "//attacker.example/path" })
    expect(consumeAuthReturnPath()).toBe("/dashboard")

    rememberAuthReturnPath({ pathname: "/\\attacker.example/path" })
    expect(consumeAuthReturnPath()).toBe("/dashboard")
  })

  it("prefers the router-provided return path and clears stale storage", () => {
    rememberAuthReturnPath({ pathname: "/stale" })

    expect(
      consumeAuthReturnPath({
        pathname: "/invitations/accept",
        search: "?token=current",
      })
    ).toBe("/invitations/accept?token=current")
    expect(sessionStorage).toHaveLength(0)
  })
})
