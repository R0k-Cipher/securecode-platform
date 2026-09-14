/*
  Warnings:

  - A unique constraint covering the columns `[login]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "login" VARCHAR(320),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "temporaryPasswordExpiresAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");
