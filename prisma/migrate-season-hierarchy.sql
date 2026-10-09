-- Migration: League → Season hierarchy
-- Introduces a Season model between League and Division.
-- Each existing League gets one Season record (carrying its season number and status).
-- Division.leagueId → Division.seasonId
-- Match gains seasonId (nullable) populated from its League → Season mapping.
-- League loses season Int and status LeagueStatus.
-- LeagueStatus enum is removed; SeasonStatus enum is created.

-- Step 1: Create SeasonStatus enum
CREATE TYPE "SeasonStatus" AS ENUM ('PLANNING', 'READY', 'ACTIVE', 'ENDED');

-- Step 2: Create Season table
CREATE TABLE "Season" (
  "id"        TEXT         NOT NULL,
  "leagueId"  TEXT         NOT NULL,
  "name"      TEXT         NOT NULL,
  "season"    INTEGER      NOT NULL,
  "status"    "SeasonStatus" NOT NULL DEFAULT 'PLANNING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Season"
  ADD CONSTRAINT "Season_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 3: Populate Season from each League (one Season per League)
INSERT INTO "Season" ("id", "leagueId", "name", "season", "status", "createdAt")
SELECT
  replace(gen_random_uuid()::text, '-', ''),
  "id",
  'Season ' || "season"::text,
  "season",
  CASE "status"
    WHEN 'READY'  THEN 'READY'::"SeasonStatus"
    WHEN 'ACTIVE' THEN 'ACTIVE'::"SeasonStatus"
    WHEN 'ENDED'  THEN 'ENDED'::"SeasonStatus"
    ELSE                'PLANNING'::"SeasonStatus"
  END,
  CURRENT_TIMESTAMP
FROM "League";

-- Step 4: Add seasonId to Division (nullable first)
ALTER TABLE "Division" ADD COLUMN "seasonId" TEXT;

-- Step 5: Populate Division.seasonId via League → Season mapping
UPDATE "Division" d
SET "seasonId" = s."id"
FROM "Season" s
WHERE s."leagueId" = d."leagueId";

-- Step 6: Make Division.seasonId NOT NULL and add FK
ALTER TABLE "Division" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "Division"
  ADD CONSTRAINT "Division_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Drop Division.leagueId FK and column
ALTER TABLE "Division" DROP CONSTRAINT "Division_leagueId_fkey";
ALTER TABLE "Division" DROP COLUMN "leagueId";

-- Step 8: Add seasonId to Match (nullable — populated going forward)
ALTER TABLE "Match" ADD COLUMN "seasonId" TEXT;

-- Step 9: Populate Match.seasonId from Match.leagueId → Season mapping
UPDATE "Match" m
SET "seasonId" = s."id"
FROM "Season" s
WHERE s."leagueId" = m."leagueId";

-- Step 10: Add FK for Match.seasonId
ALTER TABLE "Match"
  ADD CONSTRAINT "Match_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 11: Remove season and status from League
ALTER TABLE "League" DROP COLUMN "season";
ALTER TABLE "League" DROP COLUMN "status";

-- Step 12: Drop LeagueStatus enum
DROP TYPE "LeagueStatus";
