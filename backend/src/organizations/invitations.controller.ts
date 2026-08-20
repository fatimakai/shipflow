import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { API_VERSION } from '../common/http/api.constants';
import { ApiStandardErrors } from '../common/http/decorators/api-standard-errors.decorator';
import { ApiErrorResponseDto } from '../common/http/dto/api-error-response.dto';
import { AcceptInvitationDto } from './dto/organization-request.dto';
import { MembershipResponseDto } from './dto/organization-response.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organization Invitations')
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@ApiNotFoundResponse({ type: ApiErrorResponseDto })
@UseGuards(AccessTokenGuard)
@Controller({ path: 'invitations', version: API_VERSION })
export class InvitationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an email-bound organization invitation' })
  @ApiOkResponse({ type: MembershipResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiGoneResponse({ type: ApiErrorResponseDto })
  acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInvitationDto,
  ): Promise<MembershipResponseDto> {
    return this.organizationsService.acceptInvitation(user, dto);
  }
}
