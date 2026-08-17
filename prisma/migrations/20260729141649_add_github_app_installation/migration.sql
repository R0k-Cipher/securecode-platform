/*
  Warnings:

  - A unique constraint covering the columns `[provider,installationId]` on the table `git_connections` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "git_connections" ADD COLUMN     "installationId" VARCHAR(255),
ADD COLUMN     "permissions" JSONB,
ADD COLUMN     "repositorySelection" VARCHAR(50),
ALTER COLUMN "encryptedAccessToken" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "git_connections_provider_installationId_key" ON "git_connections"("provider", "installationId");
