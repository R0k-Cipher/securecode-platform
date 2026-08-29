export interface OrganizationRole {
  id:
    string;

  code:
    string;

  name:
    string;
}

export interface Organization {
  id:
    string;

  name:
    string;

  slug:
    string;

  description:
    string | null;

  logoUrl:
    string | null;

  createdAt?:
    string;

  updatedAt?:
    string;

  membersCount?:
    number;

  projectsCount?:
    number;

  currentUserRole:
    OrganizationRole |
    null;
}

export interface OrganizationPagination {
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

export interface OrganizationListResponse {
  data:
    Organization[];

  meta:
    OrganizationPagination;
}

export interface CreateOrganizationRequest {
  name:
    string;

  slug?:
    string;

  description?:
    string;

  logoUrl?:
    string;
}
