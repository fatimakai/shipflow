import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { API_VERSION } from '../common/http/api.constants';
import { ApiStandardErrors } from '../common/http/decorators/api-standard-errors.decorator';
import { ApiErrorResponseDto } from '../common/http/dto/api-error-response.dto';
import {
  NotificationListQueryDto,
  NotificationOrganizationFilterDto,
  UpdateNotificationPreferenceDto,
} from './dto/notification-request.dto';
import {
  NotificationListResponseDto,
  NotificationMarkAllReadResponseDto,
  NotificationPreferenceResponseDto,
  NotificationResponseDto,
  NotificationUnreadCountResponseDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@UseGuards(AccessTokenGuard)
@Controller({ path: 'notifications', version: API_VERSION })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiOkResponse({ type: NotificationListResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationListQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications for the current user' })
  @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationOrganizationFilterDto,
  ): Promise<NotificationUnreadCountResponseDto> {
    return this.notificationsService.unreadCount(user.id, query);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markRead(user.id, notificationId);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark current notifications as read' })
  @ApiOkResponse({ type: NotificationMarkAllReadResponseDto })
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: NotificationOrganizationFilterDto,
  ): Promise<NotificationMarkAllReadResponseDto> {
    return this.notificationsService.markAllRead(user.id, dto);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiOkResponse({ type: NotificationPreferenceResponseDto })
  getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationPreferenceResponseDto> {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update optional notification preferences' })
  @ApiOkResponse({ type: NotificationPreferenceResponseDto })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    return this.notificationsService.updatePreferences(user.id, dto);
  }
}
