'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  getDmmfModels, toPrismaKey, getAllModelFields, getScalarFields, isAutoReadonly,
} from '@/lib/data-manager-dmmf'
import { TABLE_META_OVERRIDES } from '@/lib/data-manager-meta'

type Fields = Record<string, string>

function coerceValue(raw: string, field: Prisma.DMMF.Field): unknown {
  const empty = raw === '' || raw === null || raw === undefined
  if (empty && !field.isRequired) return null

  switch (field.type) {
    case 'Int':
      return empty ? 0 : parseInt(raw, 10)
    case 'Float':
      return empty ? 0 : parseFloat(raw)
    case 'Boolean':
      return raw === 'true'
    case 'DateTime':
      return empty ? null : new Date(raw)
    default:
      // String and enums
      if (empty) return field.isRequired ? '' : null
      return raw.trim() || (field.isRequired ? '' : null)
  }
}

export async function updateTableRow(
  table: string,
  id: string,
  fields: Fields,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (session?.role !== 'ADMIN') return { error: 'Unauthorized' }

  const dmmfModel = getDmmfModels().find((m) => toPrismaKey(m.name) === table)
  if (!dmmfModel) return { error: `Unknown table: ${table}` }

  const allFields   = getAllModelFields(dmmfModel.name)
  const scalarFields = getScalarFields(dmmfModel.name)
  const overrideMeta = TABLE_META_OVERRIDES.find((t) => t.key === table)?.fieldMeta

  const data: Record<string, unknown> = {}
  for (const f of scalarFields) {
    // Skip auto-readonly (id, updatedAt, createdAt, FK ids)
    if (isAutoReadonly(f, allFields)) continue
    // Skip explicit readonly overrides from TABLE_META
    if (overrideMeta?.[f.name]?.readonly) continue
    // Skip fields not sent from the client
    if (!(f.name in fields)) continue

    data[f.name] = coerceValue(fields[f.name] ?? '', f)
  }

  try {
    await (prisma as Record<string, any>)[table].update({ where: { id }, data })
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

  const dmmfModel = getDmmfModels().find((m) => toPrismaKey(m.name) === table)
  if (!dmmfModel) return { error: `Unknown table: ${table}` }

  try {
    await (prisma as Record<string, any>)[table].delete({ where: { id } })
    revalidatePath(`/data-manager/${table}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
