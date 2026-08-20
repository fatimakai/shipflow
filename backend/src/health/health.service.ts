import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import {
  LivenessResponseDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prismaService: PrismaService,
  ) {}

  getLiveness(): LivenessResponseDto {
    return {
      status: 'ok',
      service: this.configService.getOrThrow<string>('APP_NAME'),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async getReadiness(): Promise<ReadinessResponseDto> {
    try {
      await this.prismaService.checkConnection();
    } catch {
      throw new ServiceUnavailableException('Database readiness check failed');
    }

    return {
      status: 'ok',
      checks: {
        configuration: 'up',
        database: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
