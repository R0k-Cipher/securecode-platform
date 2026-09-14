-- CreateEnum
CREATE TYPE "ScanScheduleMode" AS ENUM ('AUTO', 'FULL');

-- CreateTable
CREATE TABLE "scan_schedules" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cronExpression" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "mode" "ScanScheduleMode" NOT NULL DEFAULT 'AUTO',
    "lastTriggeredAt" TIMESTAMPTZ(6),
    "nextRunAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scan_schedules_repositoryId_key" ON "scan_schedules"("repositoryId");

-- CreateIndex
CREATE INDEX "scan_schedules_organizationId_idx" ON "scan_schedules"("organizationId");

-- CreateIndex
CREATE INDEX "scan_schedules_projectId_idx" ON "scan_schedules"("projectId");

-- CreateIndex
CREATE INDEX "scan_schedules_enabled_idx" ON "scan_schedules"("enabled");

-- CreateIndex
CREATE INDEX "scan_schedules_nextRunAt_idx" ON "scan_schedules"("nextRunAt");

-- AddForeignKey
ALTER TABLE "scan_schedules" ADD CONSTRAINT "scan_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_schedules" ADD CONSTRAINT "scan_schedules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_schedules" ADD CONSTRAINT "scan_schedules_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_schedules" ADD CONSTRAINT "scan_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
