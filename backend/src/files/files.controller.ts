import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Audit } from '../audit/audit-event.decorator';
import { AuditEvent } from '../audit/audit.constants';
import { AuditSeverity } from '../generated/prisma/enums';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CurrentOrganizationContext,
  RequireOrganizationCapabilities,
} from '../authorization/authorization.decorators';
import { Capability } from '../authorization/capability';
import type { OrganizationContext } from '../authorization/organization-context.service';
import { API_VERSION } from '../common/http/api.constants';
import { ApiStandardErrors } from '../common/http/decorators/api-standard-errors.decorator';
import {
  FileListQueryDto,
  InitiateFileUploadDto,
} from './dto/file-request.dto';
import {
  FileDownloadTargetResponseDto,
  FileListResponseDto,
  FileResponseDto,
  FileUploadReservationResponseDto,
  FileUsageResponseDto,
} from './dto/file-response.dto';
import { FilesService } from './files.service';

@ApiTags('Files')
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@UseGuards(AccessTokenGuard)
@Controller({
  path: 'organizations/:organizationId/files',
  version: API_VERSION,
})
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('uploads')
  @Audit({
    eventType: AuditEvent.FILE_UPLOAD_INITIATED,
    organization: { source: 'param', key: 'organizationId' },
    target: { type: 'file', source: 'response', key: 'file.id' },
  })
  @RequireOrganizationCapabilities(Capability.FILE_UPLOAD)
  @ApiOperation({
    summary: 'Reserve storage and create a signed upload target',
  })
  @ApiCreatedResponse({ type: FileUploadReservationResponseDto })
  initiateUpload(
    @CurrentOrganizationContext() context: OrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateFileUploadDto,
  ): Promise<FileUploadReservationResponseDto> {
    return this.files.initiateUpload(context, user.id, dto);
  }

  @Post(':fileId/complete')
  @Audit({
    eventType: AuditEvent.FILE_UPLOAD_COMPLETED,
    organization: { source: 'param', key: 'organizationId' },
    target: { type: 'file', source: 'param', key: 'fileId' },
  })
  @HttpCode(HttpStatus.OK)
  @RequireOrganizationCapabilities(Capability.FILE_UPLOAD)
  @ApiOperation({ summary: 'Validate an uploaded object and start its scan' })
  @ApiOkResponse({ type: FileResponseDto })
  completeUpload(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileResponseDto> {
    return this.files.completeUpload(context.organization.id, fileId);
  }

  @Get()
  @RequireOrganizationCapabilities(Capability.FILE_READ)
  @ApiOperation({ summary: 'List organization files' })
  @ApiOkResponse({ type: FileListResponseDto })
  listFiles(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Query() query: FileListQueryDto,
  ): Promise<FileListResponseDto> {
    return this.files.listFiles(context.organization.id, query);
  }

  @Get('usage')
  @RequireOrganizationCapabilities(Capability.FILE_READ)
  @ApiOperation({ summary: 'Read organization file storage usage and quota' })
  @ApiOkResponse({ type: FileUsageResponseDto })
  getUsage(
    @CurrentOrganizationContext() context: OrganizationContext,
  ): Promise<FileUsageResponseDto> {
    return this.files.getUsage(context.organization.id);
  }

  @Get(':fileId')
  @RequireOrganizationCapabilities(Capability.FILE_READ)
  @ApiOperation({ summary: 'Read organization file metadata' })
  @ApiOkResponse({ type: FileResponseDto })
  getFile(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileResponseDto> {
    return this.files.getFile(context.organization.id, fileId);
  }

  @Get(':fileId/download-url')
  @Audit({
    eventType: AuditEvent.FILE_DOWNLOAD_AUTHORIZED,
    organization: { source: 'param', key: 'organizationId' },
    target: { type: 'file', source: 'param', key: 'fileId' },
  })
  @RequireOrganizationCapabilities(Capability.FILE_READ)
  @ApiOperation({ summary: 'Create a short-lived private download URL' })
  @ApiOkResponse({ type: FileDownloadTargetResponseDto })
  createDownloadTarget(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileDownloadTargetResponseDto> {
    return this.files.createDownloadTarget(context.organization.id, fileId);
  }

  @Delete(':fileId')
  @Audit({
    eventType: AuditEvent.FILE_SOFT_DELETED,
    severity: AuditSeverity.WARNING,
    organization: { source: 'param', key: 'organizationId' },
    target: { type: 'file', source: 'param', key: 'fileId' },
  })
  @RequireOrganizationCapabilities(Capability.FILE_DELETE)
  @ApiOperation({ summary: 'Soft-delete an organization file' })
  @ApiOkResponse({ type: FileResponseDto })
  deleteFile(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileResponseDto> {
    return this.files.deleteFile(context.organization.id, fileId);
  }

  @Post(':fileId/restore')
  @Audit({
    eventType: AuditEvent.FILE_RESTORED,
    organization: { source: 'param', key: 'organizationId' },
    target: { type: 'file', source: 'param', key: 'fileId' },
  })
  @HttpCode(HttpStatus.OK)
  @RequireOrganizationCapabilities(Capability.FILE_DELETE)
  @ApiOperation({ summary: 'Restore a file during its recovery period' })
  @ApiOkResponse({ type: FileResponseDto })
  restoreFile(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileResponseDto> {
    return this.files.restoreFile(context.organization.id, fileId);
  }
}
