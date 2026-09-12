import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BillingModule } from '../billing/billing.module';
import type { EnvironmentVariables } from '../config/env.validation';
import { FileMaintenanceService } from './file-maintenance.service';
import { FileValidationService } from './file-validation.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalFileContentController } from './local-file-content.controller';
import { createMalwareScanner } from './malware/malware-scanner.providers';
import { MALWARE_SCANNER } from './malware/malware-scanner.types';
import { createFileStorageProvider } from './storage/file-storage.providers';
import { FILE_STORAGE } from './storage/file-storage.types';

@Module({
  imports: [AuthModule, AuthorizationModule, BillingModule],
  controllers: [FilesController, LocalFileContentController],
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        createFileStorageProvider(config),
    },
    {
      provide: MALWARE_SCANNER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        createMalwareScanner(config),
    },
    FileValidationService,
    FilesService,
    FileMaintenanceService,
  ],
  exports: [FILE_STORAGE, MALWARE_SCANNER, FilesService],
})
export class FilesModule {}
