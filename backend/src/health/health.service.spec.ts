import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import type { MalwareScanner } from '../files/malware/malware-scanner.types';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const configService = new ConfigService<EnvironmentVariables, true>({
    APP_NAME: 'ShipFlow API',
  });
  const checkConnection = jest.fn<() => Promise<void>>();
  const prismaService = { checkConnection } as unknown as PrismaService;
  const checkScannerConnection = jest.fn<() => Promise<void>>();
  const malwareScanner = {
    enabled: false,
    checkConnection: checkScannerConnection,
  } as unknown as MalwareScanner;
  const healthService = new HealthService(
    configService,
    prismaService,
    malwareScanner,
  );

  beforeEach(() => {
    checkConnection.mockReset();
    checkScannerConnection.mockReset();
    checkScannerConnection.mockResolvedValue(undefined);
  });

  it('reports configuration and database readiness', async () => {
    checkConnection.mockResolvedValue(undefined);

    await expect(healthService.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      checks: {
        configuration: 'up',
        database: 'up',
        malwareScanner: 'up',
      },
    });
    expect(checkConnection).toHaveBeenCalledTimes(1);
  });

  it('reports service unavailability when ClamAV cannot be reached', async () => {
    checkConnection.mockResolvedValue(undefined);
    checkScannerConnection.mockRejectedValue(new Error('ClamAV unavailable'));

    await expect(healthService.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('reports service unavailability when PostgreSQL cannot be queried', async () => {
    checkConnection.mockRejectedValue(new Error('PostgreSQL unavailable'));

    await expect(healthService.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
