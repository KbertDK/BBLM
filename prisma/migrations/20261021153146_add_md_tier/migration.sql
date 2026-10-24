-- AlterTable
ALTER TABLE "Race" DROP COLUMN "tierDescription";

-- CreateTable
CREATE TABLE "MdTier" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "MdTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MdTier_tier_key" ON "MdTier"("tier");

-- Seed the 4 tier reference rows before adding the FK constraint below, since
-- existing Race.tier values ("1", "1.5", "2", "3") need a matching MdTier row
-- to satisfy the new foreign key.
INSERT INTO "MdTier" ("id", "tier", "description") VALUES
    ('mdtier_1',   '1',   'Designed to win ~50–55% of games on average.'),
    ('mdtier_1_5', '1.5', 'Designed to win ~45–50% of games. Added in LRB6 to be competitive but not dominant.'),
    ('mdtier_2',   '2',   'Designed to win ~40–45% of games. High skill ceiling.'),
    ('mdtier_3',   '3',   'Designed to win ~30–35% of games. For experienced coaches seeking a challenge.');

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_tier_fkey" FOREIGN KEY ("tier") REFERENCES "MdTier"("tier") ON DELETE RESTRICT ON UPDATE CASCADE;
