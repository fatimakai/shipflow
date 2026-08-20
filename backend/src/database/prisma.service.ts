import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaClient, type Prisma } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    const databaseUrl = new URL(
      configService.getOrThrow<string>('DATABASE_URL'),
    );
    const schema = databaseUrl.searchParams.get('schema') ?? 'public';
    databaseUrl.searchParams.delete('schema');
    const slowQueryMs = configService.getOrThrow<number>(
      'DATABASE_SLOW_QUERY_MS',
    );

    const adapter = new PrismaPg(
      {
        connectionString: databaseUrl.toString(),
        connectionTimeoutMillis: configService.getOrThrow<number>(
          'DATABASE_CONNECTION_TIMEOUT_MS',
        ),
        max: configService.getOrThrow<number>('DATABASE_POOL_MAX'),
        statement_timeout: configService.getOrThrow<number>(
          'DATABASE_STATEMENT_TIMEOUT_MS',
        ),
        application_name: configService.getOrThrow<string>('APP_NAME'),
      },
      { schema },
    );

    super({
      adapter,
      log: [{ emit: 'event', level: 'query' }],
    });

    const queryEvents = this as unknown as {
      $on(event: 'query', callback: (event: Prisma.QueryEvent) => void): void;
    };
    queryEvents.$on('query', (event) => {
      if (event.duration < slowQueryMs) return;
      this.logger.warn({
        event: 'database.query.slow',
        durationMs: event.duration,
        target: event.target,
      });
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async checkConnection(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
