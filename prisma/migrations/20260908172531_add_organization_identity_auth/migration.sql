-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "organizationId" UUID,
ADD COLUMN     "organizationIdentityId" UUID;

-- CreateIndex
CREATE INDEX "sessions_organizationIdentityId_idx" ON "sessions"("organizationIdentityId");

-- CreateIndex
CREATE INDEX "sessions_organizationId_idx" ON "sessions"("organizationId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organizationIdentityId_fkey" FOREIGN KEY ("organizationIdentityId") REFERENCES "organization_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
