const LOCAL_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"])

export function getHostedBillingUrl(url: string, currentOrigin: string) {
  let target: URL

  try {
    target = new URL(url, currentOrigin)
  } catch {
    throw new Error("The billing provider returned an invalid redirect URL.")
  }

  const isSecure = target.protocol === "https:"
  const isLocalDevelopment =
    target.protocol === "http:" && LOCAL_HOSTS.has(target.hostname)

  if (!isSecure && !isLocalDevelopment) {
    throw new Error("The billing provider returned an unsafe redirect URL.")
  }

  return target.toString()
}

export function redirectToHostedBilling(url: string) {
  window.location.assign(getHostedBillingUrl(url, window.location.origin))
}
