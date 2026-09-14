import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Octokit } from '@octokit/rest';

import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type {
  GithubInstallationRepository,
  GithubRepositoryPage,
} from './types/github-repository.types';

interface GithubRepositoryApiResponse {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  default_branch: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  language: string | null;
  size: number;
  created_at: string | null;
  updated_at: string | null;
  pushed_at: string | null;
  owner: {
    id: number;
    login: string;
    avatar_url: string | null;
    type: string;
  };
}

@Injectable()
export class GithubClientService {
  /*
   * Remplace cette méthode par ton mécanisme existant :
   * - App ID
   * - private key
   * - installation ID
   * - @octokit/auth-app
   */
    constructor(
      private readonly configService: ConfigService,
    ) {}

  private async createInstallationClient(
    installationId: number,
  ): Promise<Octokit> {
    const appId =
      this.configService.get<string>(
        'GITHUB_APP_ID',
      );

    const privateKeyBase64 =
      this.configService.get<string>(
        'GITHUB_APP_PRIVATE_KEY_BASE64',
      );

    if (!appId || !privateKeyBase64) {
      throw new ServiceUnavailableException(
        'La configuration GitHub App est incomplète.',
      );
    }

    const privateKey = Buffer.from(
      privateKeyBase64,
      'base64',
    ).toString('utf8');

    const now = Math.floor(
      Date.now() / 1000,
    );

    const appJwt = jwt.sign(
      {
        iat: now - 60,
        exp: now + 9 * 60,
        iss: appId,
      },
      privateKey,
      {
        algorithm: 'RS256',
      },
    );

    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',

        headers: {
          Accept:
            'application/vnd.github+json',

          Authorization:
            `Bearer ${appJwt}`,

          'X-GitHub-Api-Version':
            this.configService.get<string>(
              'GITHUB_API_VERSION',
            ) ?? '2022-11-28',

          'User-Agent':
            'SecureCode-AI',
        },
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Impossible de générer le token GitHub pour l'installation ${installationId}.`,
      );
    }

    const data = (await response.json()) as {
      token: string;
      expires_at: string;
    };

    return new Octokit({
      auth: data.token,
    });
  }

  async listInstallationRepositories(
    installationId: number,
    page: number,
    perPage: number,
    search?: string,
  ): Promise<GithubRepositoryPage> {
    const octokit =
      await this.createInstallationClient(installationId);

    try {
      const response = await octokit.request(
        'GET /installation/repositories',
        {
          page,
          per_page: perPage,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      const data = response.data as {
        total_count: number;
        repositories: GithubRepositoryApiResponse[];
      };

      const normalizedSearch =
        search?.trim().toLowerCase() ?? null;

      const repositories = data.repositories
        .map((repository) =>
          this.mapRepository(repository),
        )
        .filter((repository) => {
          if (!normalizedSearch) {
            return true;
          }

          return (
            repository.name
              .toLowerCase()
              .includes(normalizedSearch) ||
            repository.fullName
              .toLowerCase()
              .includes(normalizedSearch)
          );
        });

      const totalPages = Math.max(
        1,
        Math.ceil(data.total_count / perPage),
      );

      return {
        items: repositories,
        pagination: {
          page,
          perPage,
          total: data.total_count,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      throw new ServiceUnavailableException(
        'Impossible de récupérer les repositories accessibles depuis GitHub.',
        {
          cause: error,
        },
      );
    }
  }

  async getInstallationRepository(
    installationId: number,
    githubRepositoryId: string,
  ): Promise<GithubInstallationRepository> {
    let page = 1;
    const perPage = 100;

    while (true) {
      const result =
        await this.listInstallationRepositories(
          installationId,
          page,
          perPage,
        );

      const repository = result.items.find(
        (item) =>
          item.id.toString() === githubRepositoryId,
      );

      if (repository) {
        return repository;
      }

      if (!result.pagination.hasNextPage) {
        break;
      }

      page += 1;
    }

    throw new NotFoundException(
      'Ce repository est introuvable ou il n’est plus accessible par cette installation GitHub.',
    );
  }

  async getLatestCommit(
    installationId: number,
    owner: string,
    repository: string,
    branch: string,
  ): Promise<{
    sha: string;
    message: string | null;
    committedAt: string | null;
  }> {
    const octokit =
      await this.createInstallationClient(installationId);

    try {
      const response = await octokit.rest.repos.getBranch({
        owner,
        repo: repository,
        branch,
      });

      return {
        sha: response.data.commit.sha,
        message:
          response.data.commit.commit.message ?? null,
        committedAt:
          response.data.commit.commit.committer?.date ??
          null,
      };
    } catch (error) {
      throw new ServiceUnavailableException(
        `Impossible de récupérer la branche "${branch}" depuis GitHub.`,
        {
          cause: error,
        },
      );
    }
  }

  async resolveCommitSha(
    installationId: number,
    owner: string,
    repository: string,
    ref: string,
  ): Promise<string> {
    const octokit =
      await this.createInstallationClient(installationId);

    try {
      const response =
        await octokit.rest.repos.getCommit({
          owner,
          repo: repository,
          ref,
        });

      return response.data.sha;
    } catch (error) {
      throw new ServiceUnavailableException(
        `Impossible de résoudre la révision "${ref}" depuis GitHub.`,
        {
          cause: error,
        },
      );
    }
  }

  private mapRepository(
    repository: GithubRepositoryApiResponse,
  ): GithubInstallationRepository {
    return {
      id: repository.id,
      nodeId: repository.node_id,
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description,

      private: repository.private,
      archived: repository.archived,
      disabled: repository.disabled,
      fork: repository.fork,

      defaultBranch: repository.default_branch,
      htmlUrl: repository.html_url,
      cloneUrl: repository.clone_url,
      sshUrl: repository.ssh_url,

      language: repository.language,
      size: repository.size,

      owner: {
        id: repository.owner.id,
        login: repository.owner.login,
        avatarUrl: repository.owner.avatar_url,
        type: repository.owner.type,
      },

      createdAt: repository.created_at,
      updatedAt: repository.updated_at,
      pushedAt: repository.pushed_at,
    };
  }
}
