import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import GameOnClient from './GameOnClient'

interface PageProps {
  params: Promise<{ id: string }>
}

function computeTV(team: {
  players:          { value: number }[]
  rerolls:          number
  race:             { rerollPrice: number }
  assistantCoaches: number
  cheerleaders:     number
  fanFactor:        number
  apothecary:       boolean
}) {
  const playerValue = team.players.reduce((s, p) => s + p.value, 0)
  return Math.round(
    (playerValue +
      team.rerolls          * team.race.rerollPrice +
      team.assistantCoaches * 10000 +
      team.cheerleaders     * 10000 +
      team.fanFactor        * 10000 +
      (team.apothecary ? 50000 : 0)) /
    1000,
  )
}

export default async function GameOnPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: {
        select: {
          id:               true,
          name:             true,
          coachId:          true,
          treasury:         true,
          fanFactor:        true,
          rerolls:          true,
          assistantCoaches: true,
          cheerleaders:     true,
          apothecary:       true,
          race:             { select: { name: true, rerollPrice: true } },
          players: {
            where:   { status: { in: ['ACTIVE', 'MNG'] } },
            select:  { id: true, number: true, name: true, status: true, ssp: true, value: true, playerType: { select: { name: true, ma: true, st: true, ag: true, av: true, startingSkills: { select: { name: true, skillRule: true } } } } },
            orderBy: { number: 'asc' },
          },
        },
      },
      awayTeam: {
        select: {
          id:               true,
          name:             true,
          coachId:          true,
          treasury:         true,
          fanFactor:        true,
          rerolls:          true,
          assistantCoaches: true,
          cheerleaders:     true,
          apothecary:       true,
          race:             { select: { name: true, rerollPrice: true } },
          players: {
            where:   { status: { in: ['ACTIVE', 'MNG'] } },
            select:  { id: true, number: true, name: true, status: true, ssp: true, value: true, playerType: { select: { name: true, ma: true, st: true, ag: true, av: true, startingSkills: { select: { name: true, skillRule: true } } } } },
            orderBy: { number: 'asc' },
          },
        },
      },
    },
  })

  if (!match) redirect('/')

  const isParticipant =
    session &&
    (session.coachId === match.homeTeam.coachId ||
     session.coachId === match.awayTeam.coachId ||
     session.role === 'COMMISH' ||
     session.role === 'ADMIN')

  if (!isParticipant) redirect('/')

  if (match.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-bb-darker flex items-center justify-center text-white">
        <div className="text-center p-8 border border-bb-border rounded-sm bg-bb-dark max-w-sm w-full">
          <div className="text-4xl mb-4">🏆</div>
          <h1 className="font-heading text-2xl font-black text-bb-gold mb-3">Match Completed</h1>
          <p className="text-bb-muted text-sm mb-1">{match.homeTeam.name}</p>
          <p className="font-heading text-4xl font-black text-white my-2">
            {match.homeScore ?? 0} – {match.awayScore ?? 0}
          </p>
          <p className="text-bb-muted text-sm">{match.awayTeam.name}</p>
        </div>
      </div>
    )
  }

  const matchData = {
    id:                match.id,
    status:            match.status as 'SCHEDULED' | 'LIVE',
    round:             match.round,
    homeTeamValue:     computeTV(match.homeTeam),
    awayTeamValue:     computeTV(match.awayTeam),
    homeTeamTreasury:  match.homeTeam.treasury,
    awayTeamTreasury:  match.awayTeam.treasury,
    homeTeamFanFactor: match.homeTeam.fanFactor,
    awayTeamFanFactor: match.awayTeam.fanFactor,
    homeTeam: {
      id:       match.homeTeam.id,
      name:     match.homeTeam.name,
      coachId:  match.homeTeam.coachId,
      raceName: match.homeTeam.race.name,
      players:  match.homeTeam.players.map((p) => ({
        id:             p.id,
        number:         p.number,
        name:           p.name,
        status:         p.status as 'ACTIVE' | 'MNG',
        playerTypeName: p.playerType.name,
        ma:             p.playerType.ma,
        st:             p.playerType.st,
        ag:             p.playerType.ag,
        av:             p.playerType.av,
        ssp:            p.ssp,
        skills:         p.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule })),
      })),
    },
    awayTeam: {
      id:       match.awayTeam.id,
      name:     match.awayTeam.name,
      coachId:  match.awayTeam.coachId,
      raceName: match.awayTeam.race.name,
      players:  match.awayTeam.players.map((p) => ({
        id:             p.id,
        number:         p.number,
        name:           p.name,
        status:         p.status as 'ACTIVE' | 'MNG',
        playerTypeName: p.playerType.name,
        ma:             p.playerType.ma,
        st:             p.playerType.st,
        ag:             p.playerType.ag,
        av:             p.playerType.av,
        ssp:            p.ssp,
        skills:         p.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule })),
      })),
    },
  }

  return <GameOnClient matchData={matchData} />
}
