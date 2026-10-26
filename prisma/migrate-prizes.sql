-- Migration: Prize Module
-- Adds PrizeType (award catalog) and PrizeAward (per-tournament assignments).
-- Inserts 7 default prize types seeded with the supplied icons.

-- Step 1: Create enums
CREATE TYPE "PrizeTargetType" AS ENUM ('TEAM', 'PLAYER');
CREATE TYPE "PrizeStatus"     AS ENUM ('ACTIVE', 'INACTIVE');

-- Step 2: Create PrizeType table
CREATE TABLE "PrizeType" (
  "id"        TEXT              NOT NULL,
  "name"      TEXT              NOT NULL,
  "type"      "PrizeTargetType" NOT NULL,
  "status"    "PrizeStatus"     NOT NULL DEFAULT 'ACTIVE',
  "icon"      TEXT              NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrizeType_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create PrizeAward table
CREATE TABLE "PrizeAward" (
  "id"           TEXT         NOT NULL,
  "prizeTypeId"  TEXT         NOT NULL,
  "tournamentId" TEXT         NOT NULL,
  "teamId"       TEXT,
  "teamPlayerId" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrizeAward_pkey" PRIMARY KEY ("id")
);

-- Step 4: Add foreign keys
ALTER TABLE "PrizeAward"
  ADD CONSTRAINT "PrizeAward_prizeTypeId_fkey"
    FOREIGN KEY ("prizeTypeId") REFERENCES "PrizeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PrizeAward_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PrizeAward_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PrizeAward_teamPlayerId_fkey"
    FOREIGN KEY ("teamPlayerId") REFERENCES "TeamPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 5: Seed default prize types
INSERT INTO "PrizeType" ("id", "name", "type", "status", "icon") VALUES
  (replace(gen_random_uuid()::text, '-', ''), '1st Place',        'TEAM',   'ACTIVE', 'horned-skull'),
  (replace(gen_random_uuid()::text, '-', ''), '2nd Place',        'TEAM',   'ACTIVE', 'silver-medal'),
  (replace(gen_random_uuid()::text, '-', ''), '3rd Place',        'TEAM',   'ACTIVE', 'bronze-medal'),
  (replace(gen_random_uuid()::text, '-', ''), 'Team Spirit',      'TEAM',   'ACTIVE', 'spiked-chalice'),
  (replace(gen_random_uuid()::text, '-', ''), 'Top Scorer',       'PLAYER', 'ACTIVE', 'golden-elf-spiked-ball'),
  (replace(gen_random_uuid()::text, '-', ''), 'Top Passer',       'PLAYER', 'ACTIVE', 'golden-quarterback'),
  (replace(gen_random_uuid()::text, '-', ''), 'Top Bone Breaker', 'PLAYER', 'ACTIVE', 'gauntlet-dagger');
