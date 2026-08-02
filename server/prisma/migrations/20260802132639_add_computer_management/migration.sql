-- CreateEnum
CREATE TYPE "ComputerMode" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'DISABLED');

-- CreateTable
CREATE TABLE "computers" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "mode" "ComputerMode" NOT NULL DEFAULT 'AVAILABLE',
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "computers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "computers_machineId_key" ON "computers"("machineId");

-- CreateIndex
CREATE INDEX "sessions_computerId_idx" ON "sessions"("computerId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "computers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
