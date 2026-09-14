import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

import type {
  GithubInstallationCallbackResponse,
  GithubInstallationUrlResponse,
  GithubRepositoryPage,
  ImportGithubRepositoryResponse,
} from '../models/github.models';


@Injectable({
  providedIn:
    'root',
})

export class GithubService {
  private readonly api =
    inject(
      ApiClientService,
    );

  /*
   * ------------------------------------------------
   * GitHub App installation
   * ------------------------------------------------
   */

  createInstallationUrl(
    organizationId:
      string,

    projectId:
      string,
  ) {
    return this.api
      .get<
        GithubInstallationUrlResponse
      >(
        `/organizations/${organizationId}/projects/${projectId}/github-app/installation-url`,
      );
  }

  /*
   * ------------------------------------------------
   * Callback
   * ------------------------------------------------
   */

  completeInstallation(
    installationId:
      string,

  ) {
    return this.api
      .get<
        GithubInstallationCallbackResponse
      >(
        '/github-app/callback',
        {
          installation_id:
            installationId,

        },
      );
  }

  /*
   * ------------------------------------------------
   * Repositories
   * ------------------------------------------------
   */

  listRepositories(
    organizationId:
      string,

    gitConnectionId:
      string,

    page =
      1,

    perPage =
      25,

    search?:
      string,
  ) {
    return this.api
      .get<
        GithubRepositoryPage
      >(
        `/organizations/${organizationId}/github-app/connections/${gitConnectionId}/repositories`,
        {
          page,

          perPage,

          search,
        },
      );
  }

  /*
   * ------------------------------------------------
   * Import
   * ------------------------------------------------
   */

  importRepository(
    organizationId:
      string,

    projectId:
      string,

    gitConnectionId:
      string,

    githubRepositoryId:
      number,

    triggerInitialSync =
      true,
  ) {
    return this.api
      .post<
        ImportGithubRepositoryResponse
      >(
        `/organizations/${organizationId}/projects/${projectId}/github-app/repositories/import`,
        {
          gitConnectionId,

          githubRepositoryId:
            String(
              githubRepositoryId,
            ),

          triggerInitialSync,
        },
      );
  }
}
