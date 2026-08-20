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
import { StripeWebhookService } from './stripe-webhook.service';

@ApiExcludeController()
@Controller({ path: 'webhooks/stripe', version: API_VERSION })
export class StripeWebhookController {
  constructor(private readonly webhookService: StripeWebhookService) {}

  @Post()
  @HttpCode(204)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<void> {
    if (!request.rawBody || !signature) {
      throw new BadRequestException('Missing webhook signature data');
    }
    await this.webhookService.process(request.rawBody, signature);
  }
}
