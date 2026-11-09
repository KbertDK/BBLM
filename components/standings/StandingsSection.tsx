import Link from 'next/link'
import clsx from 'clsx'
import SectionHeading from '@/components/ui/SectionHeading'
import type { TeamStandingRow, PlayerStatRow } from '@/lib/queries/standings'

interface Props {
  teamRows:      TeamStandingRow[]
  topScorers:    PlayerStatRow[]
  topCasualties: PlayerStatRow[]
  topPassers:    PlayerStatRow[]
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="font-heading font-black text-bb-gold">{rank}</span>
  if (rank === 2) return <span className="font-heading font-bold text-slate-300">{rank}</span>
  if (rank === 3) return <span className="font-heading font-bold text-amber-700">{rank}</span>
  return <span className="font-heading text-bb-muted/40">{rank}</span>
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-bb-dark/50 border border-bb-border rounded-sm p-6 text-center">
      <p className="text-bb-muted/50 text-sm italic">{text}</p>
    </div>
  )
}

function TeamStandingsTable({ rows }: { rows: TeamStandingRow[] }) {
  if (rows.length === 0) return <EmptyState text="No active divisions yet." />
  return (
    <div className="bg-bb-dark/50 border border-bb-border rounded-sm p-5 overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 border-b border-bb-border">
            <th className="text-left py-2 pr-2 w-8">#</th>
            <th className="text-left py-2 pr-2">Team</th>
            <th className="text-right py-2 px-2">TV</th>
            <th className="text-right py-2 px-2">W</th>
            <th className="text-right py-2 px-2">L</th>
            <th className="text-right py-2 px-2">D</th>
            <th className="text-right py-2 pl-2">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.id} className="border-b border-bb-border/30 last:border-0">
              <td className="py-2 pr-2"><RankMedal rank={i + 1} /></td>
              <td className="py-2 pr-2 text-white font-medium truncate max-w-[200px]">{t.name}</td>
              <td className="py-2 px-2 text-right tabular-nums text-bb-muted">{t.tv}k</td>
              <td className="py-2 px-2 text-right tabular-nums text-bb-muted">{t.wins}</td>
              <td className="py-2 px-2 text-right tabular-nums text-bb-muted">{t.losses}</td>
              <td className="py-2 px-2 text-right tabular-nums text-bb-muted">{t.draws}</td>
              <td className="py-2 pl-2 text-right tabular-nums text-bb-gold font-bold">{t.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Highlight = 'touchdowns' | 'casualties' | 'completePasses'

function statCls(col: Highlight, highlight: Highlight) {
  return col === highlight ? 'text-bb-gold font-bold' : 'text-bb-muted'
}

function PlayerLeaderboardTable({
  title, rows, highlight,
}: {
  title:     string
  rows:      PlayerStatRow[]
  highlight: Highlight
}) {
  return (
    <div className="bg-bb-dark/50 border border-bb-border rounded-sm p-5">
      <h3 className="text-xs font-heading tracking-widest uppercase text-bb-gold/70 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <EmptyState text="No data yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 border-b border-bb-border">
                <th className="text-left py-2 pr-2 w-8">#</th>
                <th className="text-left py-2 pr-2">Player</th>
                <th className="text-left py-2 pr-2">Team</th>
                <th className="text-right py-2 px-1.5">TD</th>
                <th className="text-right py-2 px-1.5">Cas</th>
                <th className="text-right py-2 px-1.5">Pas</th>
                <th className="text-right py-2 pl-1.5">SSP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.id} className="border-b border-bb-border/30 last:border-0">
                  <td className="py-2 pr-2"><RankMedal rank={i + 1} /></td>
                  <td className="py-2 pr-2 text-white font-medium truncate max-w-[140px]">{p.playerName}</td>
                  <td className="py-2 pr-2 text-bb-muted/70 truncate max-w-[100px]">{p.teamName}</td>
                  <td className={clsx('py-2 px-1.5 text-right tabular-nums', statCls('touchdowns', highlight))}>{p.touchdowns}</td>
                  <td className={clsx('py-2 px-1.5 text-right tabular-nums', statCls('casualties', highlight))}>{p.casualties}</td>
                  <td className={clsx('py-2 px-1.5 text-right tabular-nums', statCls('completePasses', highlight))}>{p.completePasses}</td>
                  <td className="py-2 pl-1.5 text-right tabular-nums text-bb-muted">{p.ssp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function StandingsSection({ teamRows, topScorers, topCasualties, topPassers }: Props) {
  return (
    <section>
      <SectionHeading title="Standings" subtitle="League rankings & top performers" />
      <div className="flex flex-col gap-6">
        <TeamStandingsTable rows={teamRows} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <PlayerLeaderboardTable title="Top Touchdowns" rows={topScorers} highlight="touchdowns" />
          <PlayerLeaderboardTable title="Top Casualties" rows={topCasualties} highlight="casualties" />
          <PlayerLeaderboardTable title="Top Passes" rows={topPassers} highlight="completePasses" />
        </div>
      </div>
      <div className="flex justify-center mt-6">
        <Link href="/standings"
          className="px-5 py-2 border border-bb-border text-bb-muted text-xs font-heading uppercase tracking-widest hover:text-bb-gold hover:border-bb-gold/40 rounded-sm transition-colors">
          Full Standings →
        </Link>
      </div>
    </section>
  )
}
