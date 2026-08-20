import { create } from "zustand"

import type { AuthResponseDto, AuthUserResponseDto } from "@/api/generated"

export type AuthStatus =
  "authenticated" | "error" | "restoring" | "unauthenticated"

interface AuthState {
  accessToken: string | null
  restoreError: string | null
  status: AuthStatus
  user: AuthUserResponseDto | null
  beginRestore: () => void
  clearSession: () => void
  setRestoreError: (message: string) => void
  setSession: (authentication: AuthResponseDto) => void
  setUser: (user: AuthUserResponseDto) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  restoreError: null,
  status: "restoring",
  user: null,
  beginRestore: () => set({ restoreError: null, status: "restoring" }),
  clearSession: () =>
    set({
      accessToken: null,
      restoreError: null,
      status: "unauthenticated",
      user: null,
    }),
  setRestoreError: (restoreError) =>
    set({ accessToken: null, restoreError, status: "error", user: null }),
  setSession: (authentication) =>
    set({
      accessToken: authentication.accessToken,
      restoreError: null,
      status: "authenticated",
      user: authentication.user,
    }),
  setUser: (user) => set({ user }),
}))
