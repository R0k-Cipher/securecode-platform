/*
  Warnings:

  - You are about to drop the column `login` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_login_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "login";

-- CreateTable
CREATE TABLE "organization_identities" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "login" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "temporaryPasswordExpiresAt" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "activatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_identities_login_key" ON "organization_identities"("login");

-- CreateIndex
CREATE INDEX "organization_identities_organizationId_idx" ON "organization_identities"("organizationId");

-- CreateIndex
CREATE INDEX "organization_identities_userId_idx" ON "organization_identities"("userId");

-- CreateIndex
CREATE INDEX "organization_identities_status_idx" ON "organization_identities"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_identities_organizationId_userId_key" ON "organization_identities"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "organization_identities" ADD CONSTRAINT "organization_identities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_identities" ADD CONSTRAINT "organization_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
