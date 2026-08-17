import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Octokit } from '@octokit/rest';

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
  private async createInstallationClient(
    installationId: number,
  ): Promise<Octokit> {
    throw new Error(
      `createInstallationClient(${installationId}) doit utiliser ton système d’authentification GitHub App existant.`,
    );
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
