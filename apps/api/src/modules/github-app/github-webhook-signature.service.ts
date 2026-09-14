import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

@Injectable()
export class GithubWebhookSignatureService {
  constructor(
    private readonly configService:
      ConfigService,
  ) {}

  verify(
    rawBody:
      Buffer,

    signature:
      string,
  ): void {
    const secret =
      this.configService.get<string>(
        'GITHUB_WEBHOOK_SECRET',
      );

    if (!secret) {
      throw new UnauthorizedException(
        'Secret webhook GitHub absent.',
      );
    }

    const expected =
      `sha256=${createHmac(
        'sha256',
        secret,
      )
        .update(
          rawBody,
        )
        .digest(
          'hex',
        )}`;

    const receivedBuffer =
      Buffer.from(
        signature,
        'utf8',
      );

    const expectedBuffer =
      Buffer.from(
        expected,
        'utf8',
      );

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {
      throw new UnauthorizedException(
        'Signature GitHub invalide.',
      );
    }

    if (
      !timingSafeEqual(
        receivedBuffer,
        expectedBuffer,
      )
    ) {
      throw new UnauthorizedException(
        'Signature GitHub invalide.',
      );
    }
  }
}
