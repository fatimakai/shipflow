import type {
  AuthResponseDto,
  TwoFactorChallengeResponseDto,
} from './dto/auth-response.dto';

export interface IssuedAuthentication {
  kind: 'authenticated';
  response: AuthResponseDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface IssuedTwoFactorChallenge {
  kind: 'two-factor';
  response: TwoFactorChallengeResponseDto;
}

export type AuthenticationAttempt =
  IssuedAuthentication | IssuedTwoFactorChallenge;
