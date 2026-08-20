import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../dto/api-error-response.dto';

export function ApiStandardErrors(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto),
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error',
      type: ApiErrorResponseDto,
    }),
  );
}
