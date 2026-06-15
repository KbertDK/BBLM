'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

type Fields = Record<string, string>

const str  = (f: Fields, k: string) => f[k]?.trim() ?? ''
const nullable = (f: Fields, k: string) => f[k]?.trim() || null
const int  = (f: Fields, k: string) => parseInt(f[k] ?? '0', 10)
const intN = (f: Fields, k: string) => f[k]?.trim() ? parseInt(f[k], 10) : null
const bool = (f: Fields, k: string) => f[k] === 'true'
const dateN = (f: Fields, k: string) => f[k]?.trim() ? new Date(f[k]) : null

export async function updateTableRow(
  table: string,
  id: string,
  fields: Fields,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (session?.role !== 'ADMIN') return { error: 'Unauthorized' }

  try {
    switch (table) {
      case 'coach':
        await prisma.coach.update({
          where: { id },
          data: {
            name:     str(fields, 'name'),
            alias:    nullable(fields, 'alias'),
            email:    str(fields, 'email'),
            role:     fields.role as 'ADMIN' | 'COMMISH' | 'COACH',
            isActive: bool(fields, 'isActive'),
          },
        })
        break

      case 'league':
        await prisma.league.update({
          where: { id },
          data: {
            name:     str(fields, 'name'),
            season:   int(fields, 'season'),
            status:   fields.status as 'READY' | 'ACTIVE' | 'ENDED',
            isHidden: bool(fields, 'isHidden'),
          },
        })
        break

      case 'division':
        await prisma.division.update({
          where: { id },
          data: {
            name:     str(fields, 'name'),
            isHidden: bool(fields, 'isHidden'),
          },
        })
        break

      case 'ruleSet':
        await prisma.ruleSet.update({
          where: { id },
          data: {
            name:            str(fields, 'name'),
            gameType:        fields.gameType as 'BLOOD_BOWL' | 'DUNGEON_BOWL' | 'BB7',
            startIncome:     int(fields, 'startIncome'),
            numberOfPlayers: int(fields, 'numberOfPlayers'),
            pointsWin:       int(fields, 'pointsWin'),
            pointsDraw:      int(fields, 'pointsDraw'),
            pointsLoss:      int(fields, 'pointsLoss'),
            status:          fields.status as 'ACTIVE' | 'INACTIVE',
          },
        })
        break

      case 'team':
        await prisma.team.update({
          where: { id },
          data: {
            name:     str(fields, 'name'),
            isActive: bool(fields, 'isActive'),
            wins:     int(fields, 'wins'),
            losses:   int(fields, 'losses'),
            draws:    int(fields, 'draws'),
          },
        })
        break

      case 'teamPlayer':
        await prisma.teamPlayer.update({
          where: { id },
          data: {
            number:     int(fields, 'number'),
            name:       nullable(fields, 'name'),
            status:     fields.status as 'ACTIVE' | 'MNG' | 'SACKED' | 'DEAD',
            touchdowns: int(fields, 'touchdowns'),
            casualties: int(fields, 'casualties'),
            ssp:        int(fields, 'ssp'),
            value:      int(fields, 'value'),
          },
        })
        break

      case 'match':
        await prisma.match.update({
          where: { id },
          data: {
            round:       int(fields, 'round'),
            status:      fields.status as 'SCHEDULED' | 'LIVE' | 'COMPLETED',
            homeScore:   intN(fields, 'homeScore'),
            awayScore:   intN(fields, 'awayScore'),
            scheduledAt: dateN(fields, 'scheduledAt'),
          },
        })
        break

      case 'matchEvent':
        await prisma.matchEvent.update({
          where: { id },
          data: {
            type:        str(fields, 'type'),
            label:       str(fields, 'label'),
            scoringTeam: nullable(fields, 'scoringTeam'),
          },
        })
        break

      case 'race':
        await prisma.race.update({
          where: { id },
          data: {
            name:          str(fields, 'name'),
            rerollPrice:   int(fields, 'rerollPrice'),
            hasApothecary: bool(fields, 'hasApothecary'),
            rosterSource:  str(fields, 'rosterSource'),
          },
        })
        break

      case 'playerType':
        await prisma.playerType.update({
          where: { id },
          data: {
            name:     str(fields, 'name'),
            cost:     int(fields, 'cost'),
            maxCount: int(fields, 'maxCount'),
            ma:       int(fields, 'ma'),
            st:       int(fields, 'st'),
            ag:       int(fields, 'ag'),
            av:       int(fields, 'av'),
          },
        })
        break

      case 'skill':
        await prisma.skill.update({
          where: { id },
          data: {
            name:      str(fields, 'name'),
            category:  fields.category as 'G' | 'A' | 'P' | 'S' | 'M' | 'E',
            skillRule: str(fields, 'skillRule'),
          },
        })
        break

      case 'newsPost':
        await prisma.newsPost.update({
          where: { id },
          data: {
            title: str(fields, 'title'),
          },
        })
        break

      default:
        return { error: `Unknown table: ${table}` }
    }

    revalidatePath(`/data-manager/${table}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function deleteTableRow(
  table: string,
  id: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (session?.role !== 'ADMIN') return { error: 'Unauthorized' }

  try {
    switch (table) {
      case 'coach':       await prisma.coach.delete({ where: { id } });       break
      case 'league':      await prisma.league.delete({ where: { id } });      break
      case 'division':    await prisma.division.delete({ where: { id } });    break
      case 'ruleSet':     await prisma.ruleSet.delete({ where: { id } });     break
      case 'team':        await prisma.team.delete({ where: { id } });        break
      case 'teamPlayer':  await prisma.teamPlayer.delete({ where: { id } });  break
      case 'match':       await prisma.match.delete({ where: { id } });       break
      case 'matchEvent':  await prisma.matchEvent.delete({ where: { id } });  break
      case 'race':        await prisma.race.delete({ where: { id } });        break
      case 'playerType':  await prisma.playerType.delete({ where: { id } });  break
      case 'skill':       await prisma.skill.delete({ where: { id } });       break
      case 'newsPost':    await prisma.newsPost.delete({ where: { id } });    break
      default: return { error: `Unknown table: ${table}` }
    }
    revalidatePath(`/data-manager/${table}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
