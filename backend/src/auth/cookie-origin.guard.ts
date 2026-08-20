import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class CookieOriginGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;

    if (!origin) {
      return true;
    }

    const allowedOrigins = this.configService
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',');

    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }
}
