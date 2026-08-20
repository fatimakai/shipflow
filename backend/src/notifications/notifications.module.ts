import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationRetentionService } from './notification-retention.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationRetentionService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
