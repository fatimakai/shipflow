import type { AuthUserResponseDto } from "@/api/generated"

export function getUserDisplayName(user: AuthUserResponseDto) {
  return user.displayName?.trim() || user.email.split("@")[0]
}

export function getUserInitials(user: AuthUserResponseDto) {
  const name = getUserDisplayName(user)
  const words = name.split(/\s+/).filter(Boolean)

  return (
    words.length > 1
      ? `${words[0][0]}${words.at(-1)?.[0] ?? ""}`
      : name.slice(0, 2)
  ).toUpperCase()
}
