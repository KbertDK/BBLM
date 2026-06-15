import Link from 'next/link'
import prisma from '@/lib/prisma'
import { TABLE_META } from '@/lib/data-manager-meta'

export const dynamic = 'force-dynamic'

async function getTableCounts() {
  const [
    coach, league, division, ruleSet, team, teamPlayer,
    match, matchEvent, race, playerType, skill, newsPost,
  ] = await Promise.all([
    prisma.coach.count(),
    prisma.league.count(),
    prisma.division.count(),
    prisma.ruleSet.count(),
    prisma.team.count(),
    prisma.teamPlayer.count(),
    prisma.match.count(),
    prisma.matchEvent.count(),
    prisma.race.count(),
    prisma.playerType.count(),
    prisma.skill.count(),
    prisma.newsPost.count(),
  ])
  return { coach, league, division, ruleSet, team, teamPlayer, match, matchEvent, race, playerType, skill, newsPost }
}

export default async function DataManagerPage() {
  const counts = await getTableCounts()

  return (
    <main className="min-h-screen bg-bb-dark py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-bb-gold tracking-widest uppercase">
            Data Manager
          </h1>
          <p className="mt-1 text-sm text-bb-muted">
            Overview of all database tables used in the application. Click a table name to browse its data.
          </p>
        </div>

        <div className="overflow-x-auto rounded-sm border border-bb-gold/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bb-darker border-b border-bb-gold/20">
                <th className="px-4 py-3 text-left text-xs font-heading uppercase tracking-widest text-bb-gold">Table</th>
                <th className="px-4 py-3 text-left text-xs font-heading uppercase tracking-widest text-bb-gold">Description</th>
                <th className="px-4 py-3 text-left text-xs font-heading uppercase tracking-widest text-bb-gold">Fields</th>
                <th className="px-4 py-3 text-right text-xs font-heading uppercase tracking-widest text-bb-gold">Rows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bb-gold/10">
              {TABLE_META.map((table) => {
                const count = counts[table.key as keyof typeof counts]
                return (
                  <tr key={table.key} className="bg-bb-dark hover:bg-bb-darker/60 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <Link
                        href={`/data-manager/${table.key}`}
                        className="font-mono text-bb-gold font-semibold text-xs hover:text-white hover:underline transition-colors"
                      >
                        {table.label}
                      </Link>
                    </td>
                    <td className="px-4 py-4 align-top text-bb-muted max-w-xs">
                      {table.description}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-1">
                        {table.fields.map((f) => (
                          <span
                            key={f}
                            className="inline-block font-mono text-xs px-1.5 py-0.5 rounded-sm bg-bb-gold/5 border border-bb-gold/15 text-bb-muted"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-right">
                      <span className="font-mono text-lg font-bold text-white tabular-nums">
                        {count.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-bb-darker border-t border-bb-gold/20">
                <td colSpan={3} className="px-4 py-3 text-xs text-bb-muted font-heading uppercase tracking-widest">
                  Total rows across all tables
                </td>
                <td className="px-4 py-3 text-right font-mono text-lg font-bold text-bb-gold tabular-nums">
                  {Object.values(counts).reduce((sum, n) => sum + n, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </main>
  )
}
