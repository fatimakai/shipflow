import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [FilesModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
