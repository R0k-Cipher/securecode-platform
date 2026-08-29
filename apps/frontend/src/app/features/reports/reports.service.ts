import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../core/api/api-client.service';

export type ReportFormat =
  | 'PDF'
  | 'JSON'
  | 'HTML';

export interface ProjectReport {
  id: string;
  projectId: string;
  scanId: string | null;
  requestedById: string;
  status: string;
  format: ReportFormat;
  name: string;
  fileSize: number | null;
  checksum: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  requestedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private readonly api =
    inject(
      ApiClientService,
    );

  list(
    organizationId: string,
    projectId: string,
  ) {
    return this.api.get<{
      data: ProjectReport[];
    }>(
      `/organizations/${organizationId}/projects/${projectId}/reports`,
    );
  }

  create(
    organizationId: string,
    projectId: string,
    format: ReportFormat,
    scanId?: string,
  ) {
    return this.api.post<ProjectReport>(
      `/organizations/${organizationId}/projects/${projectId}/reports`,
      {
        format,
        ...(scanId
          ? {
              scanId,
            }
          : {}),
      },
    );
  }

  download(
    organizationId: string,
    projectId: string,
    reportId: string,
  ) {
    return this.api.get<{
      id: string;
      format: ReportFormat;
      name: string;
      mimeType: string;
      content: string;
      printAsPdf: boolean;
    }>(
      `/organizations/${organizationId}/projects/${projectId}/reports/${reportId}/download`,
    );
  }
}
