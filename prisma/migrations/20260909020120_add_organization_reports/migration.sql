-- 1. Ajouter organizationId temporairement nullable
ALTER TABLE "reports"
ADD COLUMN "organizationId" UUID;

-- 2. Remplir organizationId pour les anciens rapports
-- Les anciens reports ont déjà projectId,
-- donc on récupère l'organisation via projects.organizationId.
UPDATE "reports" AS r
SET "organizationId" = p."organizationId"
FROM "projects" AS p
WHERE r."projectId" = p."id"
  AND r."organizationId" IS NULL;

-- 3. Vérification de sécurité
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "reports"
    WHERE "organizationId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Impossible de migrer reports: certains rapports ne peuvent pas être reliés à une organisation.';
  END IF;
END $$;

-- 4. Rendre projectId nullable
ALTER TABLE "reports"
ALTER COLUMN "projectId" DROP NOT NULL;

-- 5. organizationId devient obligatoire
ALTER TABLE "reports"
ALTER COLUMN "organizationId" SET NOT NULL;

-- 6. Index
CREATE INDEX "reports_organizationId_status_idx"
ON "reports"("organizationId", "status");

-- 7. Foreign key vers organizations
ALTER TABLE "reports"
ADD CONSTRAINT "reports_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "organizations"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
