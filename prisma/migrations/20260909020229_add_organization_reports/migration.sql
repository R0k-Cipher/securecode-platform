/*
  Warnings:

  - Made the column `organizationId` on table `reports` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "reports" ALTER COLUMN "organizationId" SET NOT NULL;
