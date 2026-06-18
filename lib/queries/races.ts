import prisma from '@/lib/prisma'

export interface RaceSummary {
  id: string
  name: string
  rosterSource: string
  rerollPrice: number
  hasApothecary: boolean
  teamCount: number
  tier: string
  tierDescription: string | null
}

export interface SkillRef {
  id: string
  name: string
  category: string
  skillRule: string
}

export interface PlayerTypeSummary {
  id: string
  name: string
  cost: number
  maxCount: number
  ma: number
  st: number
  ag: number
  av: number
  skillRollDouble: string
  skillRollNormal: string
  startingSkills: SkillRef[]
}

export interface RaceDetail extends RaceSummary {
  playerTypes: PlayerTypeSummary[]
}

export async function getAllRaces(): Promise<RaceSummary[]> {
  const races = await prisma.race.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { teams: true } } },
  })
  return races.map((r) => ({
    id:              r.id,
    name:            r.name,
    rosterSource:    r.rosterSource,
    rerollPrice:     r.rerollPrice,
    hasApothecary:   r.hasApothecary,
    teamCount:       r._count.teams,
    tier:            r.tier,
    tierDescription: r.tierDescription,
  }))
}

export async function getRaceById(id: string): Promise<RaceDetail | null> {
  const race = await prisma.race.findUnique({
    where: { id },
    include: {
      _count: { select: { teams: true } },
      playerTypes: {
        orderBy: { cost: 'asc' },
        include: {
          startingSkills: {
            orderBy: { skillId: 'asc' },
            select: { id: true, name: true, category: true, skillRule: true },
          },
        },
      },
    },
  })
  if (!race) return null
  return {
    id:              race.id,
    name:            race.name,
    rosterSource:    race.rosterSource,
    rerollPrice:     race.rerollPrice,
    hasApothecary:   race.hasApothecary,
    teamCount:       race._count.teams,
    tier:            race.tier,
    tierDescription: race.tierDescription,
    playerTypes:   race.playerTypes.map((p) => ({
      id:              p.id,
      name:            p.name,
      cost:            p.cost,
      maxCount:        p.maxCount,
      ma:              p.ma,
      st:              p.st,
      ag:              p.ag,
      av:              p.av,
      skillRollDouble: p.skillRollDouble,
      skillRollNormal: p.skillRollNormal,
      startingSkills:  p.startingSkills.map((s) => ({
        id:        s.id,
        name:      s.name,
        category:  s.category,
        skillRule: s.skillRule,
      })),
    })),
  }
}
