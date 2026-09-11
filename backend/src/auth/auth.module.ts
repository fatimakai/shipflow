import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AccessTokenGuard } from './access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookieOriginGuard } from './cookie-origin.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { OAuthController } from './oauth.controller';
import { GitHubOAuthGuard, GoogleOAuthGuard } from './oauth.guard';
import { OAuthStateStore } from './oauth-state.store';
import { GitHubStrategy, GoogleStrategy } from './oauth.strategy';
import { BackupCodeService } from './two-factor/backup-code.service';
import { TotpService } from './two-factor/totp.service';
import { TwoFactorCryptoService } from './two-factor/two-factor-crypto.service';

@Module({
  imports: [
    JwtModule.register({}),
    PassportModule.register({ session: false }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AccessTokenGuard,
    CookieOriginGuard,
    OAuthStateStore,
    GoogleStrategy,
    GitHubStrategy,
    GoogleOAuthGuard,
    GitHubOAuthGuard,
    TwoFactorCryptoService,
    TotpService,
    BackupCodeService,
  ],
  exports: [
    AuthService,
    AccessTokenGuard,
    TokenService,
    TwoFactorCryptoService,
    TotpService,
    BackupCodeService,
  ],
})
export class AuthModule {}
