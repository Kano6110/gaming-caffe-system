/*
  Warnings:

  - You are about to drop the column `isRevoked` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `revokedAt` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `revokedReason` on the `sessions` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `sessions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SessionEndReason" AS ENUM ('LOGGED_OUT', 'TIME_EXPIRED', 'ADMIN_ENDED', 'SUPERSEDED_BY_NEW_LOGIN');

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "isRevoked",
DROP COLUMN "revokedAt",
DROP COLUMN "revokedReason",
ADD COLUMN     "endReason" "SessionEndReason",
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "sessions_endedAt_idx" ON "sessions"("endedAt");
