import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const configService = new ConfigService<EnvironmentVariables, true>({
    APP_NAME: 'NestShip API',
  });
  const checkConnection = jest.fn<() => Promise<void>>();
  const prismaService = { checkConnection } as unknown as PrismaService;
  const healthService = new HealthService(configService, prismaService);

  beforeEach(() => {
    checkConnection.mockReset();
  });

  it('reports configuration and database readiness', async () => {
    checkConnection.mockResolvedValue(undefined);

    await expect(healthService.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      checks: {
        configuration: 'up',
        database: 'up',
      },
    });
    expect(checkConnection).toHaveBeenCalledTimes(1);
  });

  it('reports service unavailability when PostgreSQL cannot be queried', async () => {
    checkConnection.mockRejectedValue(new Error('PostgreSQL unavailable'));

    await expect(healthService.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
