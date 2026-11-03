-- Backfills schema drift: PrizeType/PrizeAward and NewsPost.matchId were present in
-- schema.prisma and fully implemented in app code, but were never captured in a
-- migration (applied to some database via `prisma db push` directly). This migration
-- brings any environment that only ever ran `prisma migrate deploy` up to date.

-- CreateEnum
CREATE TYPE "PrizeTargetType" AS ENUM ('TEAM', 'PLAYER');

-- CreateEnum
CREATE TYPE "PrizeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN     "matchId" TEXT;

-- CreateTable
CREATE TABLE "PrizeType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PrizeTargetType" NOT NULL,
    "status" "PrizeStatus" NOT NULL DEFAULT 'ACTIVE',
    "icon" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeAward" (
    "id" TEXT NOT NULL,
    "prizeTypeId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT,
    "teamPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_matchId_key" ON "NewsPost"("matchId");

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAward" ADD CONSTRAINT "PrizeAward_prizeTypeId_fkey" FOREIGN KEY ("prizeTypeId") REFERENCES "PrizeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAward" ADD CONSTRAINT "PrizeAward_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAward" ADD CONSTRAINT "PrizeAward_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAward" ADD CONSTRAINT "PrizeAward_teamPlayerId_fkey" FOREIGN KEY ("teamPlayerId") REFERENCES "TeamPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
