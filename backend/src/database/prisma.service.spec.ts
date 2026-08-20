import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prismaService: PrismaService;

  beforeEach(() => {
    const configService = new ConfigService<EnvironmentVariables, true>({
      DATABASE_URL:
        'postgresql://nestship:nestship_local_password@localhost:5432/nestship?schema=public',
      DATABASE_POOL_MAX: 10,
      DATABASE_CONNECTION_TIMEOUT_MS: 5000,
      DATABASE_STATEMENT_TIMEOUT_MS: 15000,
      DATABASE_SLOW_QUERY_MS: 500,
      APP_NAME: 'NestShip API',
    });

    prismaService = new PrismaService(configService);
  });

  it('connects when the Nest module initializes', async () => {
    const connect = jest
      .spyOn(prismaService, '$connect')
      .mockResolvedValue(undefined);

    await prismaService.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the Nest module is destroyed', async () => {
    const disconnect = jest
      .spyOn(prismaService, '$disconnect')
      .mockResolvedValue(undefined);

    await prismaService.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
