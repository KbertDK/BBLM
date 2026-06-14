'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { GameType, RuleSetStatus } from '@prisma/client'

const REVALIDATE = '/league-management'
const VALID_GAME_TYPES = ['BLOOD_BOWL', 'DUNGEON_BOWL', 'BB7']

export async function createRuleSet(formData: FormData) {
  const name            = (formData.get('name') as string).trim()
  const startIncome     = parseInt(formData.get('startIncome')     as string, 10)
  const numberOfPlayers = parseInt(formData.get('numberOfPlayers') as string, 10) || 16
  const gameType        =  formData.get('gameType') as string
  if (!name || isNaN(startIncome) || !VALID_GAME_TYPES.includes(gameType)) return
  await prisma.ruleSet.create({ data: { name, startIncome, numberOfPlayers, gameType: gameType as GameType } })
  revalidatePath(REVALIDATE)
}

export async function updateRuleSet(formData: FormData) {
  const id              =  formData.get('id')   as string
  const name            = (formData.get('name') as string).trim()
  const startIncome     = parseInt(formData.get('startIncome')     as string, 10)
  const numberOfPlayers = parseInt(formData.get('numberOfPlayers') as string, 10) || 16
  const gameType        =  formData.get('gameType') as string
  if (!name || isNaN(startIncome) || !VALID_GAME_TYPES.includes(gameType)) return
  await prisma.ruleSet.update({ where: { id }, data: { name, startIncome, numberOfPlayers, gameType: gameType as GameType } })
  revalidatePath(REVALIDATE)
}

export async function toggleRuleSetStatus(formData: FormData) {
  const id = formData.get('id') as string
  const rs = await prisma.ruleSet.findUnique({ where: { id }, select: { status: true } })
  if (!rs) return
  const next: RuleSetStatus = rs.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  await prisma.ruleSet.update({ where: { id }, data: { status: next } })
  revalidatePath(REVALIDATE)
}

export async function deleteRuleSet(formData: FormData) {
  const id    = formData.get('id') as string
  const count = await prisma.league.count({ where: { ruleSetId: id } })
  if (count > 0) return // blocked — leagues are using this ruleset
  await prisma.ruleSet.delete({ where: { id } })
  revalidatePath(REVALIDATE)
}

export async function setLeagueRuleSet(formData: FormData) {
  const id        =  formData.get('id')        as string
  const ruleSetId = (formData.get('ruleSetId') as string) || null
  await prisma.league.update({ where: { id }, data: { ruleSetId } })
  revalidatePath(REVALIDATE)
}
