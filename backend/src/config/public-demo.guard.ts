import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { EnvironmentVariables } from './env.validation';
import { PUBLIC_DEMO_UNAVAILABLE } from './public-demo.decorator';

@Injectable()
export class PublicDemoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const unavailable = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_DEMO_UNAVAILABLE,
      [context.getHandler(), context.getClass()],
    );

    if (
      unavailable &&
      this.config.getOrThrow('DEPLOYMENT_PROFILE') === 'public-demo'
    ) {
      throw new ForbiddenException(
        'This feature is unavailable in the public demo',
      );
    }

    return true;
  }
}
