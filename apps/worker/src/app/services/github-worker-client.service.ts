import {
  Injectable,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  sign,
} from 'jsonwebtoken';

interface GithubInstallationTokenResponse {
  token: string;
  expires_at: string;
}

@Injectable()
export class GithubWorkerClientService {
  private readonly githubApiUrl =
    'https://api.github.com';

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async createInstallationAccessToken(
    installationId: string,
  ): Promise<string> {
    if (
      !installationId ||
      !/^\d+$/.test(installationId)
    ) {
      throw new Error(
        'Installation GitHub invalide.',
      );
    }

    const appJwt =
      this.generateAppJwt();

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        15_000,
      );

    try {
      const response =
        await fetch(
          `${this.githubApiUrl}/app/installations/${installationId}/access_tokens`,
          {
            method: 'POST',

            headers:
              this.createHeaders(
                appJwt,
              ),

            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        const responseBody =
          await response.text();

        throw new Error(
          `GitHub installation token HTTP ${response.status}: ${responseBody.slice(0, 300)}`,
        );
      }

      const data =
        (await response.json()) as
          GithubInstallationTokenResponse;

      if (!data.token) {
        throw new Error(
          "GitHub n'a retourné aucun installation token.",
        );
      }

      return data.token;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getLatestCommit(
    installationId: string,
    owner: string,
    repositoryName: string,
    branch: string,
  ): Promise<{
    sha: string;
  }> {
    const token =
      await this.createInstallationAccessToken(
        installationId,
      );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        15_000,
      );

    try {
      const url =
        `${this.githubApiUrl}/repos/` +
        `${encodeURIComponent(owner)}/` +
        `${encodeURIComponent(repositoryName)}/` +
        `branches/${encodeURIComponent(branch)}`;

      const response =
        await fetch(
          url,
          {
            method:
              'GET',

            headers:
              this.createInstallationHeaders(
                token,
              ),

            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        const body =
          await response.text();

        throw new Error(
          `GitHub branch HTTP ${response.status}: ${body.slice(0, 300)}`,
        );
      }

      const data =
        (await response.json()) as {
          commit?: {
            sha?: string;
          };
        };

      const sha =
        data.commit?.sha?.trim();

      if (
        !sha ||
        !/^[a-f0-9]{40}$/i.test(
          sha,
        )
      ) {
        throw new Error(
          'GitHub a retourné un SHA invalide.',
        );
      }

      return {
        sha,
      };
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }

  private generateAppJwt(): string {
    const appId =
      this.getRequiredConfig(
        'GITHUB_APP_ID',
      );

    const privateKeyBase64 =
      this.getRequiredConfig(
        'GITHUB_APP_PRIVATE_KEY_BASE64',
      );

    const privateKey =
      Buffer.from(
        privateKeyBase64,
        'base64',
      ).toString('utf8');

    if (
      !privateKey.includes(
        'BEGIN',
      )
    ) {
      throw new Error(
        'Clé privée GitHub App invalide.',
      );
    }

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    return sign(
      {
        iat:
          now - 60,

        exp:
          now + 9 * 60,

        iss:
          appId,
      },
      privateKey,
      {
        algorithm:
          'RS256',
      },
    );
  }

  createInstallationHeaders(
    token: string,
  ): Record<string, string> {
    return {
      Accept:
        'application/vnd.github+json',

      Authorization:
        `Bearer ${token}`,

      'X-GitHub-Api-Version':
        this.configService.get<string>(
          'GITHUB_API_VERSION',
        ) ?? '2022-11-28',

      'User-Agent':
        'SecureCode-AI-Worker',
    };
  }

  private createHeaders(
    token: string,
  ): Record<string, string> {
    return {
      Accept:
        'application/vnd.github+json',

      Authorization:
        `Bearer ${token}`,

      'X-GitHub-Api-Version':
        this.configService.get<string>(
          'GITHUB_API_VERSION',
        ) ?? '2022-11-28',

      'User-Agent':
        'SecureCode-AI-Worker',
    };
  }

  private getRequiredConfig(
    name: string,
  ): string {
    const value =
      this.configService.get<string>(
        name,
      );

    if (
      !value ||
      value.trim().length === 0
    ) {
      throw new Error(
        `Configuration obligatoire absente : ${name}`,
      );
    }

    return value.trim();
  }
}
