-- CreateEnum
CREATE TYPE "CoachRole" AS ENUM ('ADMIN', 'COMMISH', 'COACH');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('PLANNING', 'READY', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('BLOOD_BOWL', 'DUNGEON_BOWL', 'BB7');

-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('G', 'A', 'P', 'S', 'M', 'E');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'MNG', 'DEAD', 'SACKED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startIncome" INTEGER NOT NULL,
    "gameType" "GameType" NOT NULL,
    "status" "RuleSetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numberOfPlayers" INTEGER NOT NULL DEFAULT 16,
    "pointsDraw" INTEGER NOT NULL DEFAULT 1,
    "pointsLoss" INTEGER NOT NULL DEFAULT 0,
    "pointsWin" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpirallingExpenseTier" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "teamValueThreshold" INTEGER NOT NULL,
    "expenseAmount" INTEGER NOT NULL,

    CONSTRAINT "SpirallingExpenseTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleSetId" TEXT,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "crossDivision" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "CoachRole" NOT NULL DEFAULT 'COACH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT,
    "alias" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "zip" TEXT,
    "primaryLeagueId" TEXT,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rosterSource" TEXT NOT NULL,
    "rerollPrice" INTEGER NOT NULL,
    "hasApothecary" BOOLEAN NOT NULL,
    "tier" TEXT NOT NULL DEFAULT '1',
    "tierDescription" TEXT,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerType" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "maxCount" INTEGER NOT NULL,
    "isJourneyman" BOOLEAN NOT NULL DEFAULT false,
    "ma" INTEGER NOT NULL,
    "st" INTEGER NOT NULL,
    "ag" INTEGER NOT NULL,
    "av" INTEGER NOT NULL,
    "skillRollDouble" TEXT NOT NULL,
    "skillRollNormal" TEXT NOT NULL,

    CONSTRAINT "PlayerType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL,
    "skillRule" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "divisionId" TEXT,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apothecary" BOOLEAN NOT NULL DEFAULT false,
    "assistantCoaches" INTEGER NOT NULL DEFAULT 0,
    "cheerleaders" INTEGER NOT NULL DEFAULT 0,
    "fanFactor" INTEGER NOT NULL DEFAULT 0,
    "rerolls" INTEGER NOT NULL DEFAULT 0,
    "treasury" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerTypeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "casualties" INTEGER NOT NULL DEFAULT 0,
    "completePasses" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "touchdowns" INTEGER NOT NULL DEFAULT 0,
    "mvp" INTEGER NOT NULL DEFAULT 0,
    "nigglingInjuries" INTEGER NOT NULL DEFAULT 0,
    "ssp" INTEGER NOT NULL DEFAULT 0,
    "value" INTEGER NOT NULL DEFAULT 0,
    "teamGamesAtSack" INTEGER,
    "maIncrease" INTEGER NOT NULL DEFAULT 0,
    "stIncrease" INTEGER NOT NULL DEFAULT 0,
    "agIncrease" INTEGER NOT NULL DEFAULT 0,
    "avIncrease" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeamPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayerStat" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamPlayerId" TEXT NOT NULL,
    "touchdowns" INTEGER NOT NULL DEFAULT 0,
    "completePasses" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "casualties" INTEGER NOT NULL DEFAULT 0,
    "mvp" INTEGER NOT NULL DEFAULT 0,
    "ssp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillRoll" (
    "id" TEXT NOT NULL,
    "teamPlayerId" TEXT NOT NULL,
    "die1" INTEGER NOT NULL,
    "die2" INTEGER NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "round" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tournamentId" TEXT,
    "seasonId" TEXT,
    "homeTeamValue" INTEGER,
    "awayTeamValue" INTEGER,
    "homeTeamFanFactor" INTEGER,
    "awayTeamFanFactor" INTEGER,
    "homeApothecaryUsed" BOOLEAN NOT NULL DEFAULT false,
    "awayApothecaryUsed" BOOLEAN NOT NULL DEFAULT false,
    "weatherMdMatchEventId" TEXT,
    "homePettyCash" INTEGER NOT NULL DEFAULT 0,
    "awayPettyCash" INTEGER NOT NULL DEFAULT 0,
    "homeFans" INTEGER,
    "awayFans" INTEGER,
    "homeFame" INTEGER,
    "awayFame" INTEGER,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MdSpecialPlayDeck" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "MdSpecialPlayDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MdSpecialPlayCard" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "cardLabel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "effect" TEXT NOT NULL,

    CONSTRAINT "MdSpecialPlayCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSpecialPlayCard" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "cardId" TEXT,
    "turn" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchSpecialPlayCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchStarPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "starPlayerId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "isCompanion" BOOLEAN NOT NULL DEFAULT false,
    "mvp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchStarPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchMerc" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "playerTypeId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "mvp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchMerc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchJourneyman" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "playerTypeId" TEXT NOT NULL,
    "number" INTEGER,
    "touchdowns" INTEGER NOT NULL DEFAULT 0,
    "completePasses" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "casualties" INTEGER NOT NULL DEFAULT 0,
    "mvp" INTEGER NOT NULL DEFAULT 0,
    "ssp" INTEGER NOT NULL DEFAULT 0,
    "injuryStatus" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchJourneyman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MdInducement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxCount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "rule" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MdInducement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchInducement" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "inducementId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "chefHalf1Used" BOOLEAN NOT NULL DEFAULT false,
    "chefHalf2Used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchInducement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoringTeam" TEXT,
    "mdMatchEventId" TEXT,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MdMatchEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "causesCasualty" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "dieRoll" INTEGER,
    "eventType" TEXT NOT NULL,
    "ssp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MdMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MdStarPlayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER,
    "includedWithId" TEXT,
    "ma" INTEGER NOT NULL,
    "st" INTEGER NOT NULL,
    "ag" INTEGER NOT NULL,
    "av" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MdStarPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coachNote" TEXT NOT NULL DEFAULT '',
    "playerId" TEXT,
    "teamId" TEXT,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DivisionToTournament" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PlayerTypeToSkill" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_TeamPlayerLearnedSkill" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_StarPlayerToSkill" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_StarPlayerToRace" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Coach_email_key" ON "Coach"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_alias_key" ON "Coach"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "Race_name_key" ON "Race"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_skillId_key" ON "Skill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MdSpecialPlayDeck_name_key" ON "MdSpecialPlayDeck"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MdSpecialPlayCard_deckId_cardLabel_key" ON "MdSpecialPlayCard"("deckId", "cardLabel");

-- CreateIndex
CREATE UNIQUE INDEX "MdInducement_name_key" ON "MdInducement"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MdStarPlayer_name_key" ON "MdStarPlayer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_DivisionToTournament_AB_unique" ON "_DivisionToTournament"("A", "B");

-- CreateIndex
CREATE INDEX "_DivisionToTournament_B_index" ON "_DivisionToTournament"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PlayerTypeToSkill_AB_unique" ON "_PlayerTypeToSkill"("A", "B");

-- CreateIndex
CREATE INDEX "_PlayerTypeToSkill_B_index" ON "_PlayerTypeToSkill"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TeamPlayerLearnedSkill_AB_unique" ON "_TeamPlayerLearnedSkill"("A", "B");

-- CreateIndex
CREATE INDEX "_TeamPlayerLearnedSkill_B_index" ON "_TeamPlayerLearnedSkill"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_StarPlayerToSkill_AB_unique" ON "_StarPlayerToSkill"("A", "B");

-- CreateIndex
CREATE INDEX "_StarPlayerToSkill_B_index" ON "_StarPlayerToSkill"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_StarPlayerToRace_AB_unique" ON "_StarPlayerToRace"("A", "B");

-- CreateIndex
CREATE INDEX "_StarPlayerToRace_B_index" ON "_StarPlayerToRace"("B");

-- AddForeignKey
ALTER TABLE "SpirallingExpenseTier" ADD CONSTRAINT "SpirallingExpenseTier_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_primaryLeagueId_fkey" FOREIGN KEY ("primaryLeagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerType" ADD CONSTRAINT "PlayerType_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_playerTypeId_fkey" FOREIGN KEY ("playerTypeId") REFERENCES "PlayerType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_teamPlayerId_fkey" FOREIGN KEY ("teamPlayerId") REFERENCES "TeamPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRoll" ADD CONSTRAINT "SkillRoll_teamPlayerId_fkey" FOREIGN KEY ("teamPlayerId") REFERENCES "TeamPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_weatherMdMatchEventId_fkey" FOREIGN KEY ("weatherMdMatchEventId") REFERENCES "MdMatchEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MdSpecialPlayCard" ADD CONSTRAINT "MdSpecialPlayCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "MdSpecialPlayDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSpecialPlayCard" ADD CONSTRAINT "MatchSpecialPlayCard_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSpecialPlayCard" ADD CONSTRAINT "MatchSpecialPlayCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "MdSpecialPlayDeck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSpecialPlayCard" ADD CONSTRAINT "MatchSpecialPlayCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "MdSpecialPlayCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStarPlayer" ADD CONSTRAINT "MatchStarPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStarPlayer" ADD CONSTRAINT "MatchStarPlayer_starPlayerId_fkey" FOREIGN KEY ("starPlayerId") REFERENCES "MdStarPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchMerc" ADD CONSTRAINT "MatchMerc_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchMerc" ADD CONSTRAINT "MatchMerc_playerTypeId_fkey" FOREIGN KEY ("playerTypeId") REFERENCES "PlayerType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchJourneyman" ADD CONSTRAINT "MatchJourneyman_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchJourneyman" ADD CONSTRAINT "MatchJourneyman_playerTypeId_fkey" FOREIGN KEY ("playerTypeId") REFERENCES "PlayerType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchInducement" ADD CONSTRAINT "MatchInducement_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchInducement" ADD CONSTRAINT "MatchInducement_inducementId_fkey" FOREIGN KEY ("inducementId") REFERENCES "MdInducement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_mdMatchEventId_fkey" FOREIGN KEY ("mdMatchEventId") REFERENCES "MdMatchEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MdStarPlayer" ADD CONSTRAINT "MdStarPlayer_includedWithId_fkey" FOREIGN KEY ("includedWithId") REFERENCES "MdStarPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DivisionToTournament" ADD CONSTRAINT "_DivisionToTournament_A_fkey" FOREIGN KEY ("A") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DivisionToTournament" ADD CONSTRAINT "_DivisionToTournament_B_fkey" FOREIGN KEY ("B") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlayerTypeToSkill" ADD CONSTRAINT "_PlayerTypeToSkill_A_fkey" FOREIGN KEY ("A") REFERENCES "PlayerType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlayerTypeToSkill" ADD CONSTRAINT "_PlayerTypeToSkill_B_fkey" FOREIGN KEY ("B") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeamPlayerLearnedSkill" ADD CONSTRAINT "_TeamPlayerLearnedSkill_A_fkey" FOREIGN KEY ("A") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeamPlayerLearnedSkill" ADD CONSTRAINT "_TeamPlayerLearnedSkill_B_fkey" FOREIGN KEY ("B") REFERENCES "TeamPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StarPlayerToSkill" ADD CONSTRAINT "_StarPlayerToSkill_A_fkey" FOREIGN KEY ("A") REFERENCES "MdStarPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StarPlayerToSkill" ADD CONSTRAINT "_StarPlayerToSkill_B_fkey" FOREIGN KEY ("B") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StarPlayerToRace" ADD CONSTRAINT "_StarPlayerToRace_A_fkey" FOREIGN KEY ("A") REFERENCES "MdStarPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StarPlayerToRace" ADD CONSTRAINT "_StarPlayerToRace_B_fkey" FOREIGN KEY ("B") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
