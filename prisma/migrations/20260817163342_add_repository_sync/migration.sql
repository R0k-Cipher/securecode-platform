/*
  Warnings:

  - Made the column `createdById` on table `repositories` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "repositories" DROP CONSTRAINT "repositories_createdById_fkey";

-- AlterTable
ALTER TABLE "repositories" ALTER COLUMN "createdById" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
