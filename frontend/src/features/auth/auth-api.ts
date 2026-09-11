import { apiClient } from "@/api/api-client"
import type {
  AuthResponseDto,
  AuthUserResponseDto,
  EmailDto,
  LoginDto,
  MessageResponseDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
  TotpCodeDto,
  TwoFactorChallengeDto,
  TwoFactorChallengeResponseDto,
  TwoFactorEnabledResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorStatusResponseDto,
  TwoFactorStepUpDto,
  UpdateProfileDto,
} from "@/api/generated"
import { env } from "@/config/env"

export type LoginRequest = LoginDto & { password: string }
export type RegisterRequest = RegisterDto & { password: string }
export type LoginResponse = AuthResponseDto | TwoFactorChallengeResponseDto

export function isTwoFactorChallenge(
  response: LoginResponse
): response is TwoFactorChallengeResponseDto {
  return "requiresTwoFactor" in response && response.requiresTwoFactor === true
}

export const authApi = {
  confirmEmail: (body: TokenDto) =>
    apiClient.post<MessageResponseDto>("/auth/email-verification/confirm", {
      json: body,
    }),
  currentUser: () =>
    apiClient.get<AuthUserResponseDto>("/auth/me", { auth: true }),
  forgotPassword: (body: EmailDto) =>
    apiClient.post<MessageResponseDto>("/auth/password/forgot", { json: body }),
  login: (body: LoginRequest) =>
    apiClient.post<LoginResponse>("/auth/login", {
      includeCredentials: true,
      json: body,
    }),
  logout: () =>
    apiClient.post<MessageResponseDto>("/auth/logout", {
      includeCredentials: true,
    }),
  logoutAll: () =>
    apiClient.post<MessageResponseDto>("/auth/logout-all", {
      auth: true,
      includeCredentials: true,
    }),
  oauthUrl: (provider: "github" | "google") =>
    `${env.apiBaseUrl}/auth/oauth/${provider}`,
  refresh: () =>
    apiClient.post<AuthResponseDto>("/auth/refresh", {
      includeCredentials: true,
    }),
  register: (body: RegisterRequest) =>
    apiClient.post<AuthResponseDto>("/auth/register", {
      includeCredentials: true,
      json: body,
    }),
  requestEmailVerification: () =>
    apiClient.post<MessageResponseDto>("/auth/email-verification/request", {
      auth: true,
    }),
  resetPassword: (body: ResetPasswordDto) =>
    apiClient.post<MessageResponseDto>("/auth/password/reset", { json: body }),
  twoFactor: {
    beginSetup: () =>
      apiClient.post<TwoFactorSetupResponseDto>("/auth/2fa/setup", {
        auth: true,
      }),
    confirmSetup: (body: TotpCodeDto) =>
      apiClient.post<TwoFactorEnabledResponseDto>("/auth/2fa/setup/confirm", {
        auth: true,
        includeCredentials: true,
        json: body,
      }),
    disable: (body: TwoFactorStepUpDto) =>
      apiClient.delete<MessageResponseDto>("/auth/2fa", {
        auth: true,
        includeCredentials: true,
        json: body,
      }),
    regenerateBackupCodes: (body: TwoFactorStepUpDto) =>
      apiClient.post<TwoFactorEnabledResponseDto>(
        "/auth/2fa/backup-codes/regenerate",
        { auth: true, json: body }
      ),
    status: () =>
      apiClient.get<TwoFactorStatusResponseDto>("/auth/2fa/status", {
        auth: true,
      }),
    verifyChallenge: (body: TwoFactorChallengeDto) =>
      apiClient.post<AuthResponseDto>("/auth/2fa/challenge/verify", {
        includeCredentials: true,
        json: body,
      }),
  },
  updateProfile: (body: UpdateProfileDto) =>
    apiClient.patch<AuthUserResponseDto>("/auth/me", {
      auth: true,
      json: body,
    }),
}
