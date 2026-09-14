import {
  Injectable,
  inject,
} from '@angular/core';

import {
  map,
} from 'rxjs';

import {
  ApiClientService,
} from '../../core/api/api-client.service';

export type ReportFormat =
  | 'PDF'
  | 'JSON'
  | 'HTML';

export type ReportScope =
  | 'SCAN'
  | 'REPOSITORY'
  | 'PROJECT'
  | 'ORGANIZATION';

export type ReportStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'EXPIRED'
  | string;

export interface ProjectReport {
  id:
    string;

  organizationId?:
    string;

  projectId:
    string |
    null;

  scanId:
    string |
    null;

  requestedById:
    string;

  status:
    ReportStatus;

  scope?:
    ReportScope;

  format:
    ReportFormat;

  name:
    string;

  fileSize:
    number |
    null;

  checksum:
    string |
    null;

  generatedAt:
    string |
    null;

  expiresAt:
    string |
    null;

  errorMessage:
    string |
    null;

  createdAt:
    string;

  filters?:
    Record<
      string,
      unknown
    > |
    null;

  scan?: {
    id:
      string;

    repositoryId:
      string;

    trigger:
      string;

    status:
      string;

    score:
      number |
      null;

    createdAt:
      string;
  } |
  null;

  requestedBy: {
    id:
      string;

    email:
      string;

    firstName:
      string;

    lastName:
      string;
  };
}

interface ReportsApiResponse {
  data:
    ProjectReport[];
}

export interface ReportDownloadPayload {
  id:
    string;

  format:
    ReportFormat;

  name:
    string;

  mimeType:
    string;

  contentBase64:
    string;
}

@Injectable({
  providedIn:
    'root',
})
export class ReportsService {
  private readonly api =
    inject(
      ApiClientService,
    );

  /*
  |--------------------------------------------------------------------------
  | Project reports
  |--------------------------------------------------------------------------
  */

  list(
    organizationId:
      string,

    projectId:
      string,

    repositoryId?:
      string,
  ) {
    return this.api
      .get<
        ReportsApiResponse |
        ProjectReport[]
      >(
        `/organizations/${organizationId}/projects/${projectId}/reports`,

        repositoryId
          ? {
              repositoryId,
            }
          : undefined,
      )
      .pipe(
        map(
          response => {
            if (
              Array.isArray(
                response,
              )
            ) {
              return {
                data:
                  response,
              };
            }

            return {
              data:
                Array.isArray(
                  response?.data,
                )
                  ? response.data
                  : [],
            };
          },
        ),
      );
  }

  createScan(
    organizationId:
      string,

    projectId:
      string,

    scanId:
      string,

    format:
      ReportFormat =
        'PDF',
  ) {
    return this.api
      .post<ProjectReport>(
        `/organizations/${organizationId}/projects/${projectId}/reports`,
        {
          scope:
            'SCAN',

          scanId,

          format,
        },
      );
  }

  createRepository(
    organizationId:
      string,

    projectId:
      string,

    repositoryId:
      string,

    format:
      ReportFormat =
        'PDF',
  ) {
    return this.api
      .post<ProjectReport>(
        `/organizations/${organizationId}/projects/${projectId}/reports`,
        {
          scope:
            'REPOSITORY',

          repositoryId,

          format,
        },
      );
  }

  createProject(
    organizationId:
      string,

    projectId:
      string,

    fromDate:
      string,

    toDate:
      string,

    format:
      ReportFormat =
        'PDF',
  ) {
    return this.api
      .post<ProjectReport>(
        `/organizations/${organizationId}/projects/${projectId}/reports`,
        {
          scope:
            'PROJECT',

          fromDate,

          toDate,

          format,
        },
      );
  }

  download(
    organizationId:
      string,

    projectId:
      string,

    reportId:
      string,
  ) {
    return this.api
      .get<ReportDownloadPayload>(
        `/organizations/${organizationId}/projects/${projectId}/reports/${reportId}/download`,
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Organization reports
  |--------------------------------------------------------------------------
  */

  listOrganization(
    organizationId:
      string,
  ) {
    return this.api
      .get<
        ReportsApiResponse |
        ProjectReport[]
      >(
        `/organizations/${organizationId}/reports`,
      )
      .pipe(
        map(
          response => {
            if (
              Array.isArray(
                response,
              )
            ) {
              return {
                data:
                  response,
              };
            }

            return {
              data:
                Array.isArray(
                  response?.data,
                )
                  ? response.data
                  : [],
            };
          },
        ),
      );
  }

  createOrganization(
    organizationId:
      string,

    fromDate:
      string,

    toDate:
      string,

    format:
      ReportFormat =
        'PDF',
  ) {
    return this.api
      .post<ProjectReport>(
        `/organizations/${organizationId}/reports`,
        {
          scope:
            'ORGANIZATION',

          fromDate,

          toDate,

          format,
        },
      );
  }

  downloadOrganization(
    organizationId:
      string,

    reportId:
      string,
  ) {
    return this.api
      .get<ReportDownloadPayload>(
        `/organizations/${organizationId}/reports/${reportId}/download`,
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Save file
  |--------------------------------------------------------------------------
  */

  save(
    payload:
      ReportDownloadPayload,
  ):
    void {
    const binary =
      atob(
        payload.contentBase64,
      );

    const bytes =
      new Uint8Array(
        binary.length,
      );

    for (
      let index = 0;
      index <
      binary.length;
      index += 1
    ) {
      bytes[
        index
      ] =
        binary.charCodeAt(
          index,
        );
    }

    const url =
      URL.createObjectURL(
        new Blob(
          [
            bytes,
          ],
          {
            type:
              payload.mimeType,
          },
        ),
      );

    const anchor =
      document.createElement(
        'a',
      );

    anchor.href =
      url;

    anchor.download =
      payload.name;

    document.body.appendChild(
      anchor,
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url,
    );
  }
}
