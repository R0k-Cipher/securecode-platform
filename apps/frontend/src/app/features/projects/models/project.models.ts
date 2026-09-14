export type ProjectStatus =
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'SUSPENDED';

export interface ProjectCounters {
  members:
    number;

  repositories:
    number;

  scans:
    number;

  findings:
    number;

  vulnerabilities:
    number;

  reports:
    number;
}

export interface Project {
  id:
    string;

  organizationId:
    string;

  name:
    string;

  slug:
    string;

  description:
    string | null;

  status:
    ProjectStatus;

  defaultBranch:
    string | null;

  createdById?:
    string;

  createdAt:
    string;

  updatedAt:
    string;

  archivedAt:
    string | null;

  /*

   */
  membersCount?:
    number;

  repositoriesCount?:
    number;

  scansCount?:
    number;

  findingsCount?:
    number;

  vulnerabilitiesCount?:
    number;

  reportsCount?:
    number;
}

export interface ProjectPagination {
  page:
    number;

  limit:
    number;

  total:
    number;

  totalPages:
    number;

  hasNextPage:
    boolean;

  hasPreviousPage:
    boolean;
}

export interface ProjectListResponse {
  data:
    Project[];

  meta:
    ProjectPagination;
}

export interface CreateProjectRequest {
  name:
    string;

  slug?:
    string;

  description?:
    string;

  defaultBranch?:
    string;
}

export type UpdateProjectRequest =
  Partial<
    CreateProjectRequest
  >;
