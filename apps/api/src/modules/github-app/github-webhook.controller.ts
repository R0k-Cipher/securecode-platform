import {
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  GithubWebhookService,
} from './github-webhook.service';

@ApiTags('GitHub Webhooks')
@Controller('webhooks/github')
export class GithubWebhookController {
  constructor(
    private readonly githubWebhookService:
      GithubWebhookService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Recevoir les événements webhook GitHub',
  })
  handleWebhook(
    @Req()
    request:
      RawBodyRequest<Request>,

    @Headers(
      'x-hub-signature-256',
    )
    signature:
      string | undefined,

    @Headers(
      'x-github-event',
    )
    eventType:
      string | undefined,

    @Headers(
      'x-github-delivery',
    )
    deliveryId:
      string | undefined,
  ) {
    if (
      !signature ||
      !eventType ||
      !deliveryId ||
      !request.rawBody
    ) {
      throw new UnauthorizedException(
        'Webhook GitHub invalide ou incomplet.',
      );
    }

    return this.githubWebhookService
      .handle({
        signature,

        eventType,

        deliveryId,

        rawBody:
          request.rawBody,

        payload:
          request.body,
      });
  }
}
