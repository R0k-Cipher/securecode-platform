-- CreateTable
CREATE TABLE "github_installation_pendings" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_installation_pendings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "github_installation_pendings_organizationId_idx" ON "github_installation_pendings"("organizationId");

-- CreateIndex
CREATE INDEX "github_installation_pendings_projectId_idx" ON "github_installation_pendings"("projectId");

-- CreateIndex
CREATE INDEX "github_installation_pendings_userId_createdAt_idx" ON "github_installation_pendings"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "github_installation_pendings_expiresAt_idx" ON "github_installation_pendings"("expiresAt");

-- AddForeignKey
ALTER TABLE "github_installation_pendings" ADD CONSTRAINT "github_installation_pendings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_installation_pendings" ADD CONSTRAINT "github_installation_pendings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_installation_pendings" ADD CONSTRAINT "github_installation_pendings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
