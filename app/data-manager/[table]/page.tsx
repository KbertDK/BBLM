import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import {
  getDmmfModels, toPrismaKey, getScalarFields, buildResolvedMeta,
} from '@/lib/data-manager-dmmf'
import DataTable, { type SerializedRow } from './DataTable'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

async function fetchRows(
  tableName: string,
  skip: number,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const dmmfModel = getDmmfModels().find((m) => toPrismaKey(m.name) === tableName)
  if (!dmmfModel) return { rows: [], total: 0 }

  const delegate = (prisma as Record<string, any>)[tableName]
  if (!delegate) return { rows: [], total: 0 }

  const scalarFields = getScalarFields(dmmfModel.name)
  const hasCreatedAt = scalarFields.some((f) => f.name === 'createdAt')
  const hasName      = scalarFields.some((f) => f.name === 'name')
  const orderBy = hasCreatedAt
    ? { createdAt: 'desc' as const }
    : hasName
      ? { name: 'asc' as const }
      : { id: 'asc' as const }

  const [rows, total] = await Promise.all([
    delegate.findMany({ skip, take: PAGE_SIZE, orderBy }),
    delegate.count(),
  ])

  // Mask the password hash — never send it to the client
  if (tableName === 'coach') {
    for (const row of rows) delete row.passwordHash
  }

  // Resolve mdMatchEventId → human-readable name for display
  if (tableName === 'matchEvent') {
    const mdEvents = await prisma.mdMatchEvent.findMany({ select: { id: true, name: true } })
    const nameById = new Map<string, string>(mdEvents.map((e: { id: string; name: string }) => [e.id, e.name]))
    for (const row of rows) {
      const refId = row.mdMatchEventId as string | null
      if (refId && nameById.has(refId)) {
        row.mdMatchEventId = nameById.get(refId)!
      }
    }
  }

  return { rows, total }
}

function serializeRows(rows: Record<string, unknown>[]): SerializedRow[] {
  return rows.map((row) => {
    const out: SerializedRow = {}
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) out[k] = null
      else if (v instanceof Date) out[k] = v.toISOString()
      else out[k] = String(v)
    }
    return out
  })
}

interface Props {
  params: Promise<{ table: string }>
  searchParams?: Promise<{ page?: string }>
}

export default async function TableDetailPage({ params, searchParams }: Props) {
  const { table } = await params
  const resolvedSP = await (searchParams ?? Promise.resolve<{ page?: string }>({}))
  const pageParam  = resolvedSP.page

  const meta = buildResolvedMeta(table)
  if (!meta) notFound()

  const page  = Math.max(1, parseInt(pageParam ?? '1', 10))
  const skip  = (page - 1) * PAGE_SIZE

  const { rows, total } = await fetchRows(table, skip)
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const serialized = serializeRows(rows)

  return (
    <main className="min-h-screen bg-bb-dark py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-full mx-auto">

        <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Link
            href="/data-manager"
            className="text-bb-muted hover:text-bb-gold text-xs uppercase tracking-widest transition-colors"
          >
            ← Data Manager
          </Link>
          <h1 className="font-heading text-2xl font-bold text-bb-gold tracking-widest uppercase">
            {meta.label}
          </h1>
          <span className="text-bb-muted text-sm">{total.toLocaleString()} rows</span>
        </div>
        <p className="text-sm text-bb-muted mb-6">{meta.description}</p>

        <DataTable tableName={table} meta={meta} rows={serialized} skip={skip} />

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2">
            {page > 1 && (
              <Link
                href={`/data-manager/${table}?page=${page - 1}`}
                className="px-3 py-1 text-xs border border-bb-border text-bb-muted hover:text-bb-gold hover:border-bb-gold/40 rounded-sm transition-colors"
              >
                ← Prev
              </Link>
            )}
            <span className="text-xs text-bb-muted">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link
                href={`/data-manager/${table}?page=${page + 1}`}
                className="px-3 py-1 text-xs border border-bb-border text-bb-muted hover:text-bb-gold hover:border-bb-gold/40 rounded-sm transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
