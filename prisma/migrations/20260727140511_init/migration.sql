/*
  Warnings:

  - You are about to drop the `system_health` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('REFRESH', 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'INVITATION');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GitProvider" AS ENUM ('GITHUB', 'GITLAB');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "RepositoryVisibility" AS ENUM ('PRIVATE', 'INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PullRequestState" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('FULL_SCAN', 'INCREMENTAL_SCAN', 'PULL_REQUEST_SCAN', 'RELEASE_SCAN', 'MANUAL_SCAN');

-- CreateEnum
CREATE TYPE "ScanTrigger" AS ENUM ('MANUAL', 'PUSH', 'PULL_REQUEST', 'RELEASE', 'SCHEDULED', 'API');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'PREPARING', 'DOWNLOADING', 'DETECTING', 'SCANNING', 'PROCESSING_RESULTS', 'CALCULATING_SCORE', 'GENERATING_REPORT', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TechnologyCategory" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'LIBRARY', 'DATABASE', 'RUNTIME', 'PACKAGE_MANAGER', 'BUILD_TOOL', 'CONTAINER', 'INFRASTRUCTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('DETECTED', 'TO_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE', 'ASSIGNED', 'IN_PROGRESS', 'READY_FOR_RETEST', 'FIXED', 'REOPENED', 'ACCEPTED_RISK', 'CLOSED');

-- CreateEnum
CREATE TYPE "VulnerabilityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED_RISK', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WstgControlStatus" AS ENUM ('NOT_STARTED', 'AUTOMATICALLY_TESTED', 'MANUAL_REVIEW_REQUIRED', 'COMPLIANT', 'VULNERABLE', 'PARTIALLY_COMPLIANT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'JSON', 'HTML');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'INVITE', 'ACCEPT_INVITATION', 'CONNECT', 'DISCONNECT', 'SCAN', 'EXPORT', 'DOWNLOAD', 'ASSIGN', 'CHANGE_STATUS');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'INVITATION', 'SCAN_STARTED', 'SCAN_COMPLETED', 'SCAN_FAILED', 'FINDING_ASSIGNED', 'FINDING_UPDATED', 'REPORT_READY');

-- DropTable
DROP TABLE "system_health";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255),
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "avatarUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" VARCHAR(255) NOT NULL,
    "ipAddress" VARCHAR(64),
    "userAgent" TEXT,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "type" "TokenType" NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(150) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "invitedById" UUID,
    "joinedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "roleId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultBranch" VARCHAR(255),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_connections" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectedById" UUID NOT NULL,
    "provider" "GitProvider" NOT NULL,
    "externalAccountId" VARCHAR(255) NOT NULL,
    "externalAccountName" VARCHAR(255),
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMPTZ(6),
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "git_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "gitConnectionId" UUID NOT NULL,
    "provider" "GitProvider" NOT NULL,
    "externalId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(500) NOT NULL,
    "cloneUrl" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "defaultBranch" VARCHAR(255) NOT NULL,
    "visibility" "RepositoryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commits" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "externalSha" VARCHAR(64) NOT NULL,
    "branch" VARCHAR(255),
    "message" TEXT,
    "authorName" VARCHAR(255),
    "authorEmail" VARCHAR(320),
    "committedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "externalId" VARCHAR(255) NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "sourceBranch" VARCHAR(255) NOT NULL,
    "targetBranch" VARCHAR(255) NOT NULL,
    "authorName" VARCHAR(255),
    "state" "PullRequestState" NOT NULL DEFAULT 'OPEN',
    "headCommitSha" VARCHAR(64),
    "baseCommitSha" VARCHAR(64),
    "openedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "mergedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "externalId" VARCHAR(255) NOT NULL,
    "tagName" VARCHAR(255) NOT NULL,
    "name" VARCHAR(500),
    "targetCommitSha" VARCHAR(64),
    "releasedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "gitConnectionId" UUID,
    "repositoryId" UUID,
    "provider" "GitProvider" NOT NULL,
    "externalEventId" VARCHAR(255),
    "eventType" VARCHAR(150) NOT NULL,
    "deliveryId" VARCHAR(255),
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "commitId" UUID,
    "pullRequestId" UUID,
    "releaseId" UUID,
    "requestedById" UUID,
    "type" "ScanType" NOT NULL,
    "trigger" "ScanTrigger" NOT NULL DEFAULT 'MANUAL',
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "branch" VARCHAR(255) NOT NULL,
    "commitSha" VARCHAR(64) NOT NULL,
    "score" DECIMAL(5,2),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "queueJobId" VARCHAR(255),
    "configuration" JSONB,
    "statistics" JSONB,
    "queuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_technologies" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "version" VARCHAR(100),
    "category" "TechnologyCategory" NOT NULL,
    "confidence" DECIMAL(5,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "ruleId" VARCHAR(255) NOT NULL,
    "scanner" VARCHAR(150) NOT NULL,
    "fingerprint" VARCHAR(128) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'DETECTED',
    "category" VARCHAR(255),
    "owaspCategory" VARCHAR(100),
    "cweId" VARCHAR(50),
    "cvssScore" DECIMAL(3,1),
    "filePath" TEXT,
    "startLine" INTEGER,
    "startColumn" INTEGER,
    "endLine" INTEGER,
    "endColumn" INTEGER,
    "codeSnippet" TEXT,
    "recommendation" TEXT,
    "confidence" DECIMAL(5,2),
    "metadata" JSONB,
    "firstDetectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_occurrences" (
    "id" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "filePath" TEXT,
    "startLine" INTEGER,
    "startColumn" INTEGER,
    "endLine" INTEGER,
    "endColumn" INTEGER,
    "commitSha" VARCHAR(64) NOT NULL,
    "detectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_comments" (
    "id" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "finding_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_assignments" (
    "id" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "assignedToId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMPTZ(6),

    CONSTRAINT "finding_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerabilities" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "VulnerabilityStatus" NOT NULL DEFAULT 'OPEN',
    "cweId" VARCHAR(50),
    "cvssScore" DECIMAL(3,1),
    "ownerId" UUID,
    "dueDate" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(6),

    CONSTRAINT "vulnerabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerability_findings" (
    "vulnerabilityId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vulnerability_findings_pkey" PRIMARY KEY ("vulnerabilityId","findingId")
);

-- CreateTable
CREATE TABLE "wstg_controls" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "category" VARCHAR(150) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "version" VARCHAR(50) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wstg_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_wstg_controls" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlId" UUID NOT NULL,
    "status" "WstgControlStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "evidence" TEXT,
    "notes" TEXT,
    "lastTestedAt" TIMESTAMPTZ(6),
    "reviewedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_wstg_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_wstg_controls" (
    "findingId" UUID NOT NULL,
    "controlId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_wstg_controls_pkey" PRIMARY KEY ("findingId","controlId")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "scanId" UUID,
    "requestedById" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "format" "ReportFormat" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "storagePath" TEXT,
    "fileSize" BIGINT,
    "checksum" VARCHAR(128),
    "filters" JSONB,
    "generatedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "projectId" UUID,
    "actorId" UUID,
    "action" "AuditAction" NOT NULL,
    "resourceType" VARCHAR(150) NOT NULL,
    "resourceId" VARCHAR(255),
    "description" TEXT,
    "ipAddress" VARCHAR(64),
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "sessions_revokedAt_idx" ON "sessions"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "security_tokens_tokenHash_key" ON "security_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "security_tokens_userId_type_idx" ON "security_tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "security_tokens_type_expiresAt_idx" ON "security_tokens"("type", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_isSystem_idx" ON "roles"("isSystem");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_createdById_idx" ON "organizations"("createdById");

-- CreateIndex
CREATE INDEX "organizations_createdAt_idx" ON "organizations"("createdAt");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE INDEX "organization_members_roleId_idx" ON "organization_members"("roleId");

-- CreateIndex
CREATE INDEX "organization_members_invitedById_idx" ON "organization_members"("invitedById");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_organizationId_email_idx" ON "invitations"("organizationId", "email");

-- CreateIndex
CREATE INDEX "invitations_roleId_idx" ON "invitations"("roleId");

-- CreateIndex
CREATE INDEX "invitations_invitedById_idx" ON "invitations"("invitedById");

-- CreateIndex
CREATE INDEX "invitations_expiresAt_idx" ON "invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "projects_organizationId_status_idx" ON "projects"("organizationId", "status");

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organizationId_slug_key" ON "projects"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE INDEX "project_members_roleId_idx" ON "project_members"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE INDEX "git_connections_connectedById_idx" ON "git_connections"("connectedById");

-- CreateIndex
CREATE INDEX "git_connections_provider_status_idx" ON "git_connections"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "git_connections_organizationId_provider_externalAccountId_key" ON "git_connections"("organizationId", "provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "repositories_gitConnectionId_idx" ON "repositories"("gitConnectionId");

-- CreateIndex
CREATE INDEX "repositories_projectId_isArchived_idx" ON "repositories"("projectId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_provider_externalId_key" ON "repositories"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_projectId_fullName_key" ON "repositories"("projectId", "fullName");

-- CreateIndex
CREATE INDEX "commits_repositoryId_branch_idx" ON "commits"("repositoryId", "branch");

-- CreateIndex
CREATE INDEX "commits_committedAt_idx" ON "commits"("committedAt");

-- CreateIndex
CREATE UNIQUE INDEX "commits_repositoryId_externalSha_key" ON "commits"("repositoryId", "externalSha");

-- CreateIndex
CREATE INDEX "pull_requests_repositoryId_state_idx" ON "pull_requests"("repositoryId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_repositoryId_externalId_key" ON "pull_requests"("repositoryId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_repositoryId_number_key" ON "pull_requests"("repositoryId", "number");

-- CreateIndex
CREATE INDEX "releases_releasedAt_idx" ON "releases"("releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "releases_repositoryId_externalId_key" ON "releases"("repositoryId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "releases_repositoryId_tagName_key" ON "releases"("repositoryId", "tagName");

-- CreateIndex
CREATE INDEX "webhook_events_gitConnectionId_idx" ON "webhook_events"("gitConnectionId");

-- CreateIndex
CREATE INDEX "webhook_events_repositoryId_idx" ON "webhook_events"("repositoryId");

-- CreateIndex
CREATE INDEX "webhook_events_provider_eventType_idx" ON "webhook_events"("provider", "eventType");

-- CreateIndex
CREATE INDEX "webhook_events_status_receivedAt_idx" ON "webhook_events"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_deliveryId_key" ON "webhook_events"("provider", "deliveryId");

-- CreateIndex
CREATE INDEX "scans_projectId_status_idx" ON "scans"("projectId", "status");

-- CreateIndex
CREATE INDEX "scans_repositoryId_createdAt_idx" ON "scans"("repositoryId", "createdAt");

-- CreateIndex
CREATE INDEX "scans_commitId_idx" ON "scans"("commitId");

-- CreateIndex
CREATE INDEX "scans_pullRequestId_idx" ON "scans"("pullRequestId");

-- CreateIndex
CREATE INDEX "scans_releaseId_idx" ON "scans"("releaseId");

-- CreateIndex
CREATE INDEX "scans_requestedById_idx" ON "scans"("requestedById");

-- CreateIndex
CREATE INDEX "scans_status_queuedAt_idx" ON "scans"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "scans_commitSha_idx" ON "scans"("commitSha");

-- CreateIndex
CREATE INDEX "scan_technologies_name_category_idx" ON "scan_technologies"("name", "category");

-- CreateIndex
CREATE UNIQUE INDEX "scan_technologies_scanId_name_version_category_key" ON "scan_technologies"("scanId", "name", "version", "category");

-- CreateIndex
CREATE INDEX "findings_scanId_idx" ON "findings"("scanId");

-- CreateIndex
CREATE INDEX "findings_projectId_severity_status_idx" ON "findings"("projectId", "severity", "status");

-- CreateIndex
CREATE INDEX "findings_repositoryId_ruleId_idx" ON "findings"("repositoryId", "ruleId");

-- CreateIndex
CREATE INDEX "findings_status_updatedAt_idx" ON "findings"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "findings_cweId_idx" ON "findings"("cweId");

-- CreateIndex
CREATE INDEX "findings_owaspCategory_idx" ON "findings"("owaspCategory");

-- CreateIndex
CREATE UNIQUE INDEX "findings_repositoryId_fingerprint_key" ON "findings"("repositoryId", "fingerprint");

-- CreateIndex
CREATE INDEX "finding_occurrences_scanId_idx" ON "finding_occurrences"("scanId");

-- CreateIndex
CREATE INDEX "finding_occurrences_commitSha_idx" ON "finding_occurrences"("commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "finding_occurrences_findingId_scanId_filePath_startLine_sta_key" ON "finding_occurrences"("findingId", "scanId", "filePath", "startLine", "startColumn");

-- CreateIndex
CREATE INDEX "finding_comments_findingId_createdAt_idx" ON "finding_comments"("findingId", "createdAt");

-- CreateIndex
CREATE INDEX "finding_comments_authorId_idx" ON "finding_comments"("authorId");

-- CreateIndex
CREATE INDEX "finding_assignments_findingId_unassignedAt_idx" ON "finding_assignments"("findingId", "unassignedAt");

-- CreateIndex
CREATE INDEX "finding_assignments_assignedToId_unassignedAt_idx" ON "finding_assignments"("assignedToId", "unassignedAt");

-- CreateIndex
CREATE INDEX "finding_assignments_assignedById_idx" ON "finding_assignments"("assignedById");

-- CreateIndex
CREATE INDEX "vulnerabilities_projectId_severity_status_idx" ON "vulnerabilities"("projectId", "severity", "status");

-- CreateIndex
CREATE INDEX "vulnerabilities_ownerId_status_idx" ON "vulnerabilities"("ownerId", "status");

-- CreateIndex
CREATE INDEX "vulnerabilities_dueDate_idx" ON "vulnerabilities"("dueDate");

-- CreateIndex
CREATE INDEX "vulnerability_findings_findingId_idx" ON "vulnerability_findings"("findingId");

-- CreateIndex
CREATE INDEX "wstg_controls_category_isActive_idx" ON "wstg_controls"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "wstg_controls_code_version_key" ON "wstg_controls"("code", "version");

-- CreateIndex
CREATE INDEX "project_wstg_controls_controlId_idx" ON "project_wstg_controls"("controlId");

-- CreateIndex
CREATE INDEX "project_wstg_controls_reviewedById_idx" ON "project_wstg_controls"("reviewedById");

-- CreateIndex
CREATE INDEX "project_wstg_controls_projectId_status_idx" ON "project_wstg_controls"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_wstg_controls_projectId_controlId_key" ON "project_wstg_controls"("projectId", "controlId");

-- CreateIndex
CREATE INDEX "finding_wstg_controls_controlId_idx" ON "finding_wstg_controls"("controlId");

-- CreateIndex
CREATE INDEX "reports_projectId_status_idx" ON "reports"("projectId", "status");

-- CreateIndex
CREATE INDEX "reports_scanId_idx" ON "reports"("scanId");

-- CreateIndex
CREATE INDEX "reports_requestedById_idx" ON "reports"("requestedById");

-- CreateIndex
CREATE INDEX "reports_expiresAt_idx" ON "reports"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_projectId_createdAt_idx" ON "audit_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_tokens" ADD CONSTRAINT "security_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_connections" ADD CONSTRAINT "git_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_connections" ADD CONSTRAINT "git_connections_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_gitConnectionId_fkey" FOREIGN KEY ("gitConnectionId") REFERENCES "git_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_gitConnectionId_fkey" FOREIGN KEY ("gitConnectionId") REFERENCES "git_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "commits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "pull_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_technologies" ADD CONSTRAINT "scan_technologies_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_occurrences" ADD CONSTRAINT "finding_occurrences_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_occurrences" ADD CONSTRAINT "finding_occurrences_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_comments" ADD CONSTRAINT "finding_comments_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_comments" ADD CONSTRAINT "finding_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_assignments" ADD CONSTRAINT "finding_assignments_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_assignments" ADD CONSTRAINT "finding_assignments_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_assignments" ADD CONSTRAINT "finding_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vulnerability_findings" ADD CONSTRAINT "vulnerability_findings_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vulnerability_findings" ADD CONSTRAINT "vulnerability_findings_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_wstg_controls" ADD CONSTRAINT "project_wstg_controls_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_wstg_controls" ADD CONSTRAINT "project_wstg_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "wstg_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_wstg_controls" ADD CONSTRAINT "project_wstg_controls_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_wstg_controls" ADD CONSTRAINT "finding_wstg_controls_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_wstg_controls" ADD CONSTRAINT "finding_wstg_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "wstg_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
