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
  UpdateProfileDto,
} from "@/api/generated"
import { env } from "@/config/env"

export type LoginRequest = LoginDto & { password: string }
export type RegisterRequest = RegisterDto & { password: string }

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
    apiClient.post<AuthResponseDto>("/auth/login", {
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
  updateProfile: (body: UpdateProfileDto) =>
    apiClient.patch<AuthUserResponseDto>("/auth/me", {
      auth: true,
      json: body,
    }),
}
