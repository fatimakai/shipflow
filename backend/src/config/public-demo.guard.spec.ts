import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { EnvironmentVariables } from './env.validation';
import { PublicDemoGuard } from './public-demo.guard';

describe('PublicDemoGuard', () => {
  const context = {
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
  } as ExecutionContext;

  const createGuard = (profile: EnvironmentVariables['DEPLOYMENT_PROFILE']) =>
    new PublicDemoGuard(
      {
        getAllAndOverride: jest.fn().mockReturnValue(true),
      } as unknown as Reflector,
      {
        getOrThrow: jest.fn().mockReturnValue(profile),
      } as unknown as ConfigService<EnvironmentVariables, true>,
    );

  it('rejects decorated endpoints in the public demo', () => {
    expect(() => createGuard('public-demo').canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('leaves the same endpoint available in the standard profile', () => {
    expect(createGuard('standard').canActivate(context)).toBe(true);
  });
});
