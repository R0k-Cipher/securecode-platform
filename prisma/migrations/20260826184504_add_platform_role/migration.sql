-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "scanner_file_caches" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "fileHash" VARCHAR(64) NOT NULL,
    "scannerId" VARCHAR(150) NOT NULL,
    "scannerVersion" VARCHAR(50) NOT NULL,
    "rulesetVersion" VARCHAR(100) NOT NULL,
    "findings" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),

    CONSTRAINT "scanner_file_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scanner_file_caches_organizationId_repositoryId_idx" ON "scanner_file_caches"("organizationId", "repositoryId");

-- CreateIndex
CREATE INDEX "scanner_file_caches_expiresAt_idx" ON "scanner_file_caches"("expiresAt");

-- CreateIndex
CREATE INDEX "scanner_file_caches_lastUsedAt_idx" ON "scanner_file_caches"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "scanner_file_caches_organizationId_repositoryId_fileHash_sc_key" ON "scanner_file_caches"("organizationId", "repositoryId", "fileHash", "scannerId", "scannerVersion", "rulesetVersion");

-- CreateIndex
CREATE INDEX "users_platformRole_idx" ON "users"("platformRole");

-- AddForeignKey
ALTER TABLE "scanner_file_caches" ADD CONSTRAINT "scanner_file_caches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanner_file_caches" ADD CONSTRAINT "scanner_file_caches_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
