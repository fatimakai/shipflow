import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from './common/http/api.constants';
import { ApiStandardErrors } from './common/http/decorators/api-standard-errors.decorator';
import { AppService } from './app.service';

@ApiTags('Application')
@ApiStandardErrors()
@Controller({ version: API_VERSION })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get the API welcome message' })
  @ApiOkResponse({ example: 'Hello World!', type: String })
  getHello(): string {
    return this.appService.getHello();
  }
}
