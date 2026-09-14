-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('ORGANIZATION', 'PROJECT');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "scope" "RoleScope";

-- CreateIndex
CREATE INDEX "roles_scope_idx" ON "roles"("scope");
