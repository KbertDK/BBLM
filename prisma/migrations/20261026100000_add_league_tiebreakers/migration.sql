-- AlterTable: add configurable tiebreaker order to League
ALTER TABLE "League" ADD COLUMN "standingsTiebreakers" TEXT;
