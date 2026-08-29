/*
  Warnings:

  - A unique constraint covering the columns `[gitConnectionId,externalId]` on the table `repositories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `repositories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner` to the `repositories` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RepositorySyncStatus" AS ENUM ('NOT_SYNCED', 'PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RepositorySyncTrigger" AS ENUM ('INITIAL_IMPORT', 'MANUAL', 'WEBHOOK', 'SCHEDULED', 'RETRY');

-- DropIndex
DROP INDEX "repositories_provider_externalId_key";

-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isFork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastRemoteCommitSha" VARCHAR(64),
ADD COLUMN     "nodeId" VARCHAR(255),
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "owner" VARCHAR(255) NOT NULL,
ADD COLUMN     "primaryLanguage" VARCHAR(100),
ADD COLUMN     "sshUrl" TEXT,
ADD COLUMN     "syncStatus" "RepositorySyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
ALTER COLUMN "cloneUrl" DROP NOT NULL,
ALTER COLUMN "defaultBranch" DROP NOT NULL;

-- CreateTable
CREATE TABLE "repository_syncs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "triggeredById" UUID,
    "status" "RepositorySyncStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "RepositorySyncTrigger" NOT NULL,
    "branch" VARCHAR(255),
    "commitSha" VARCHAR(64),
    "queueJobId" VARCHAR(255),
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "repository_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repository_syncs_organizationId_idx" ON "repository_syncs"("organizationId");

-- CreateIndex
CREATE INDEX "repository_syncs_repositoryId_idx" ON "repository_syncs"("repositoryId");

-- CreateIndex
CREATE INDEX "repository_syncs_triggeredById_idx" ON "repository_syncs"("triggeredById");

-- CreateIndex
CREATE INDEX "repository_syncs_status_idx" ON "repository_syncs"("status");

-- CreateIndex
CREATE INDEX "repository_syncs_repositoryId_status_idx" ON "repository_syncs"("repositoryId", "status");

-- CreateIndex
CREATE INDEX "repository_syncs_createdAt_idx" ON "repository_syncs"("createdAt");

-- CreateIndex
CREATE INDEX "repository_syncs_queueJobId_idx" ON "repository_syncs"("queueJobId");

-- CreateIndex
CREATE INDEX "repositories_organizationId_idx" ON "repositories"("organizationId");

-- CreateIndex
CREATE INDEX "repositories_projectId_idx" ON "repositories"("projectId");

-- CreateIndex
CREATE INDEX "repositories_createdById_idx" ON "repositories"("createdById");

-- CreateIndex
CREATE INDEX "repositories_syncStatus_idx" ON "repositories"("syncStatus");

-- CreateIndex
CREATE INDEX "repositories_organizationId_syncStatus_idx" ON "repositories"("organizationId", "syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_gitConnectionId_externalId_key" ON "repositories"("gitConnectionId", "externalId");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_syncs" ADD CONSTRAINT "repository_syncs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_syncs" ADD CONSTRAINT "repository_syncs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_syncs" ADD CONSTRAINT "repository_syncs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
