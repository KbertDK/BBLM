import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { TABLE_META } from '@/lib/data-manager-meta'
import DataTable, { type SerializedRow } from './DataTable'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

async function fetchRows(table: string, skip: number): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const opts = { skip, take: PAGE_SIZE } as const
  switch (table) {
    case 'coach': {
      const [raw, total] = await Promise.all([
        prisma.coach.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.coach.count(),
      ])
      return { rows: raw.map(r => ({ ...r, passwordHash: '[hidden]' })), total }
    }
    case 'league': {
      const [rows, total] = await Promise.all([
        prisma.league.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.league.count(),
      ])
      return { rows, total }
    }
    case 'division': {
      const [rows, total] = await Promise.all([
        prisma.division.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.division.count(),
      ])
      return { rows, total }
    }
    case 'ruleSet': {
      const [rows, total] = await Promise.all([
        prisma.ruleSet.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.ruleSet.count(),
      ])
      return { rows, total }
    }
    case 'team': {
      const [rows, total] = await Promise.all([
        prisma.team.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.team.count(),
      ])
      return { rows, total }
    }
    case 'teamPlayer': {
      const [rows, total] = await Promise.all([
        prisma.teamPlayer.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.teamPlayer.count(),
      ])
      return { rows, total }
    }
    case 'match': {
      const [rows, total] = await Promise.all([
        prisma.match.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.match.count(),
      ])
      return { rows, total }
    }
    case 'matchEvent': {
      const [rows, total] = await Promise.all([
        prisma.matchEvent.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.matchEvent.count(),
      ])
      return { rows, total }
    }
    case 'race': {
      const [rows, total] = await Promise.all([
        prisma.race.findMany({ ...opts, orderBy: { name: 'asc' } }),
        prisma.race.count(),
      ])
      return { rows, total }
    }
    case 'playerType': {
      const [rows, total] = await Promise.all([
        prisma.playerType.findMany({ ...opts, orderBy: { name: 'asc' } }),
        prisma.playerType.count(),
      ])
      return { rows, total }
    }
    case 'skill': {
      const [rows, total] = await Promise.all([
        prisma.skill.findMany({ ...opts, orderBy: { skillId: 'asc' } }),
        prisma.skill.count(),
      ])
      return { rows, total }
    }
    case 'newsPost': {
      const [rows, total] = await Promise.all([
        prisma.newsPost.findMany({ ...opts, orderBy: { createdAt: 'desc' } }),
        prisma.newsPost.count(),
      ])
      return { rows, total }
    }
    default:
      return { rows: [], total: 0 }
  }
}

function serializeRows(rows: Record<string, unknown>[]): SerializedRow[] {
  return rows.map(row => {
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
  params: { table: string }
  searchParams?: { page?: string }
}

export default async function TableDetailPage({ params, searchParams }: Props) {
  const meta = TABLE_META.find(t => t.key === params.table)
  if (!meta) notFound()

  const page = Math.max(1, parseInt(searchParams?.page ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  const { rows, total } = await fetchRows(params.table, skip)
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

        <DataTable
          tableName={params.table}
          meta={meta}
          rows={serialized}
          skip={skip}
        />

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2">
            {page > 1 && (
              <Link
                href={`/data-manager/${params.table}?page=${page - 1}`}
                className="px-3 py-1 text-xs border border-bb-border text-bb-muted hover:text-bb-gold hover:border-bb-gold/40 rounded-sm transition-colors"
              >
                ← Prev
              </Link>
            )}
            <span className="text-xs text-bb-muted">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link
                href={`/data-manager/${params.table}?page=${page + 1}`}
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
