interface ReturnLocation {
  hash?: string
  pathname?: string
  search?: string
}

const AUTH_RETURN_PATH_KEY = "shipflow:auth:return-path"
const DEFAULT_AUTH_RETURN_PATH = "/dashboard"

function sanitizeReturnPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null
  }

  try {
    const base = new URL("https://shipflow.invalid")
    const parsed = new URL(value, base)

    if (parsed.origin !== base.origin) return null

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function pathFromLocation(location?: ReturnLocation): string | null {
  if (!location?.pathname) return null

  return sanitizeReturnPath(
    `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`
  )
}

export function rememberAuthReturnPath(location?: ReturnLocation) {
  const returnPath = pathFromLocation(location)

  try {
    if (returnPath) {
      sessionStorage.setItem(AUTH_RETURN_PATH_KEY, returnPath)
    } else {
      sessionStorage.removeItem(AUTH_RETURN_PATH_KEY)
    }
  } catch {
    // OAuth can still complete when browser storage is unavailable.
  }
}

export function consumeAuthReturnPath(location?: ReturnLocation) {
  const directReturnPath = pathFromLocation(location)
  let storedReturnPath: string | null = null

  try {
    storedReturnPath = sessionStorage.getItem(AUTH_RETURN_PATH_KEY)
    sessionStorage.removeItem(AUTH_RETURN_PATH_KEY)
  } catch {
    // Fall back to the direct route or dashboard when storage is unavailable.
  }

  return (
    directReturnPath ??
    sanitizeReturnPath(storedReturnPath) ??
    DEFAULT_AUTH_RETURN_PATH
  )
}
