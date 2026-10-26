-- AlterTable: add ELO rating to Coach
ALTER TABLE "Coach" ADD COLUMN "eloRating" DOUBLE PRECISION NOT NULL DEFAULT 1500;

-- AlterTable: add ELO rating to Team
ALTER TABLE "Team" ADD COLUMN "eloRating" DOUBLE PRECISION NOT NULL DEFAULT 1500;

-- AlterTable: add ELO change audit fields to Match
ALTER TABLE "Match" ADD COLUMN "homeEloChange" DOUBLE PRECISION;
ALTER TABLE "Match" ADD COLUMN "awayEloChange" DOUBLE PRECISION;
