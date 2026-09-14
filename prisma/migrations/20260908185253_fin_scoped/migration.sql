-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "RoleScope" AS ENUM ('ORGANIZATION', 'PROJECT');
EXCEPTION
    WHEN duplicate_object THEN null;
END
$$;

-- Add scope column if not already present
ALTER TABLE "roles"
ADD COLUMN IF NOT EXISTS "scope" "RoleScope";

-- Organization roles
UPDATE "roles"
SET "scope" = 'ORGANIZATION'
WHERE "code" IN (
    'OWNER',
    'ADMIN'
);

-- Project roles
UPDATE "roles"
SET "scope" = 'PROJECT'
WHERE "code" IN (
    'PROJECT_ADMIN',
    'MANAGER',
    'SECURITY_ANALYST',
    'DEVELOPER',
    'AUDITOR',
    'VIEWER'
);

-- Safety check:
-- stop migration if any role is still without scope
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "roles"
        WHERE "scope" IS NULL
    ) THEN
        RAISE EXCEPTION
            'Impossible de rendre roles.scope obligatoire : certains rôles ont encore scope = NULL.';
    END IF;
END
$$;

-- Make scope required
ALTER TABLE "roles"
ALTER COLUMN "scope" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "roles_scope_idx"
ON "roles"("scope");
