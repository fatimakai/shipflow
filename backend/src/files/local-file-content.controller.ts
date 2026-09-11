import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiExcludeController } from '@nestjs/swagger';
import { API_VERSION } from '../common/http/api.constants';
import { FILE_MAX_SIZE_BYTES } from './file.constants';
import { SignedFileRequestQueryDto } from './dto/file-request.dto';
import { FilesService } from './files.service';

interface MemoryUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@ApiExcludeController()
@Controller({ path: 'file-content', version: API_VERSION })
export class LocalFileContentController {
  constructor(private readonly files: FilesService) {}

  @Post(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fieldNameSize: 100,
        fieldSize: 1024,
        fields: 1,
        fileSize: FILE_MAX_SIZE_BYTES,
        files: 1,
        parts: 2,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async upload(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query() query: SignedFileRequestQueryDto,
    @UploadedFile() file?: MemoryUpload,
  ): Promise<void> {
    if (!file)
      throw new BadRequestException('Multipart file field is required');
    await this.files.storeLocalUpload(
      fileId,
      query.expires,
      query.signature,
      file,
    );
  }

  @Get(':fileId')
  async download(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query() query: SignedFileRequestQueryDto,
  ): Promise<StreamableFile> {
    const file = await this.files.readLocalDownload(
      fileId,
      query.expires,
      query.signature,
    );
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      length: file.body.length,
    });
  }
}
