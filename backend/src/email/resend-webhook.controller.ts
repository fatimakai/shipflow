import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { API_VERSION } from '../common/http/api.constants';
import { ResendWebhookService } from './resend-webhook.service';

@ApiExcludeController()
@Controller({ path: 'webhooks/resend', version: API_VERSION })
export class ResendWebhookController {
  constructor(private readonly webhookService: ResendWebhookService) {}

  @Post()
  @HttpCode(204)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('svix-id') id?: string,
    @Headers('svix-signature') signature?: string,
    @Headers('svix-timestamp') timestamp?: string,
  ): Promise<void> {
    if (!request.rawBody || !id || !signature || !timestamp) {
      throw new BadRequestException('Missing webhook signature data');
    }

    await this.webhookService.process(request.rawBody, {
      id,
      signature,
      timestamp,
    });
  }
}
