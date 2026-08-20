import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { RequestTimeoutException } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { RequestTimeoutInterceptor } from './request-timeout.interceptor';

describe('RequestTimeoutInterceptor', () => {
  const context = {} as ExecutionContext;

  it('passes responses completed within the configured limit', async () => {
    const interceptor = new RequestTimeoutInterceptor(50);
    const next = { handle: () => of('ok') } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toBe('ok');
  });

  it('returns a standard request-timeout exception for slow handlers', async () => {
    const interceptor = new RequestTimeoutInterceptor(5);
    const next = { handle: () => of('late').pipe(delay(25)) } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBeInstanceOf(RequestTimeoutException);
  });
});
