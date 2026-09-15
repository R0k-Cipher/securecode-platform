CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "contextualScore" DECIMAL(5,2) NOT NULL,
    "priority" VARCHAR(30) NOT NULL,
    "epssScore" DECIMAL(6,5),
    "knownExploited" BOOLEAN NOT NULL DEFAULT false,
    "reachable" BOOLEAN,
    "internetExposed" BOOLEAN,
    "assetCriticality" INTEGER NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "factors" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "evidence" JSONB,
    "engineVersion" VARCHAR(30) NOT NULL,
    "calculatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attack_paths" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    "entryPoint" TEXT,
    "targetAsset" TEXT,
    "findingIds" JSONB NOT NULL,
    "graph" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "detectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "attack_paths_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "risk_assessments_findingId_key" ON "risk_assessments"("findingId");
CREATE INDEX "risk_assessments_organizationId_projectId_idx" ON "risk_assessments"("organizationId", "projectId");
CREATE INDEX "risk_assessments_projectId_priority_contextualScore_idx" ON "risk_assessments"("projectId", "priority", "contextualScore");
CREATE INDEX "risk_assessments_repositoryId_contextualScore_idx" ON "risk_assessments"("repositoryId", "contextualScore");
CREATE INDEX "risk_assessments_scanId_idx" ON "risk_assessments"("scanId");
CREATE INDEX "risk_assessments_knownExploited_idx" ON "risk_assessments"("knownExploited");
CREATE INDEX "attack_paths_organizationId_projectId_idx" ON "attack_paths"("organizationId", "projectId");
CREATE INDEX "attack_paths_projectId_status_score_idx" ON "attack_paths"("projectId", "status", "score");
CREATE INDEX "attack_paths_repositoryId_status_idx" ON "attack_paths"("repositoryId", "status");
CREATE INDEX "attack_paths_scanId_idx" ON "attack_paths"("scanId");

ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attack_paths" ADD CONSTRAINT "attack_paths_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attack_paths" ADD CONSTRAINT "attack_paths_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attack_paths" ADD CONSTRAINT "attack_paths_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attack_paths" ADD CONSTRAINT "attack_paths_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
