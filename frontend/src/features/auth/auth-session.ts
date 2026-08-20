import { isApiError } from "@/api/api-error"
import type { AuthResponseDto } from "@/api/generated"
import { queryClient } from "@/api/query-client"
import { useAuthStore } from "@/stores/auth.store"
import { useOrganizationStore } from "@/stores/organization.store"

import { authApi } from "./auth-api"
import { getAuthErrorMessage } from "./auth-errors"

let restorePromise: Promise<void> | null = null

export function applyAuthentication(authentication: AuthResponseDto) {
  useAuthStore.getState().setSession(authentication)
}

export function clearSessionState() {
  useAuthStore.getState().clearSession()
  useOrganizationStore.getState().clearActiveOrganization()
  queryClient.clear()
}

export function restoreSession() {
  if (restorePromise) {
    return restorePromise
  }

  useAuthStore.getState().beginRestore()
  restorePromise = authApi
    .refresh()
    .then(applyAuthentication)
    .catch((error: unknown) => {
      if (isApiError(error) && error.statusCode === 401) {
        clearSessionState()
        return
      }

      useAuthStore
        .getState()
        .setRestoreError(
          getAuthErrorMessage(error, "Unable to restore your session.")
        )
    })
    .finally(() => {
      restorePromise = null
    })

  return restorePromise
}

export async function refreshForApiClient() {
  try {
    const authentication = await authApi.refresh()
    applyAuthentication(authentication)
    return authentication.accessToken
  } catch (error) {
    clearSessionState()
    throw error
  }
}

export async function signOut() {
  try {
    await authApi.logout()
  } finally {
    clearSessionState()
  }
}

export async function signOutAll() {
  try {
    await authApi.logoutAll()
  } finally {
    clearSessionState()
  }
}
