import fs from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'

export const metadata = { title: 'Rules — Blood Bowl League Manager' }

// Playing-card rank order — a plain alphabetical sort would put "10 ♥" before "2 ♥".
const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

async function sizeLabelFor(filename: string): Promise<string | null> {
  try {
    const stat = await fs.stat(path.join(process.cwd(), 'public', filename))
    return `PDF · ${(stat.size / (1024 * 1024)).toFixed(1)} MB`
  } catch {
    return null
  }
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function PdfCard({
  title, description, filename, sizeLabel,
}: {
  title:       string
  description: string
  filename:    string
  sizeLabel:   string | null
}) {
  return (
    <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50">
      <div className="px-6 py-5 border-b border-bb-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase mb-1">
              {title}
            </h2>
            <p className="text-bb-muted text-sm">{description}</p>
          </div>
          {sizeLabel && (
            <div className="text-bb-muted/40 text-xs shrink-0 pt-1">{sizeLabel}</div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 flex items-center gap-4">
        <a
          href={`/${filename}`}
          download={filename}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold uppercase tracking-widest text-xs rounded-sm border border-bb-crimson-bright/50 transition-all shadow-lg shadow-bb-crimson/20"
        >
          <DownloadIcon />
          Download {title}
        </a>
        <a
          href={`/${filename}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-bb-muted border border-bb-border hover:text-bb-gold hover:border-bb-gold/50 font-heading font-bold uppercase tracking-widest text-xs rounded-sm transition-all"
        >
          <OpenIcon />
          Open in browser
        </a>
      </div>
    </div>
  )
}

export default async function RulesPage() {
  const [decksRaw, lrb6Size, crp1Size, generalSize, passingSize, teamsSize, leagueSize] = await Promise.all([
    prisma.mdSpecialPlayDeck.findMany({ orderBy: { price: 'asc' }, include: { cards: true } }),
    sizeLabelFor('LRB6.pdf'),
    sizeLabelFor('CRP1.pdf'),
    sizeLabelFor('LRB6-General.pdf'),
    sizeLabelFor('LRB6-Passing.pdf'),
    sizeLabelFor('LRB6-Teams.pdf'),
    sizeLabelFor('LRB6-League.pdf'),
  ])
  const decks = decksRaw.map((deck) => ({
    ...deck,
    cards: [...deck.cards].sort((a, b) => {
      const rankA = RANK_ORDER.indexOf(a.cardLabel.split(' ')[0])
      const rankB = RANK_ORDER.indexOf(b.cardLabel.split(' ')[0])
      return rankA !== rankB ? rankA - rankB : a.cardLabel.localeCompare(b.cardLabel)
    }),
  }))

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <h1 className="font-heading text-4xl font-black text-bb-gold tracking-widest uppercase mb-2">
          Rules
        </h1>
        <p className="text-bb-muted text-sm tracking-wide mb-10 italic">
          The sacred texts of Nuffle.
        </p>

        <div className="flex flex-col gap-6">

        <PdfCard
          title="Living Rulebook 6"
          description="The comprehensive Blood Bowl rulebook — LRB6, the definitive edition used
            by this league. Covers all rules, rosters, star players, special play cards,
            and league management."
          filename="LRB6.pdf"
          sizeLabel={lrb6Size}
        />

        <PdfCard
          title="Competition Rules Pack 1"
          description="Official Blood Bowl competition rules supplement — CRP1. Covers tournament
            formats, additional rosters, star players, and event guidelines for organised play."
          filename="CRP1.pdf"
          sizeLabel={crp1Size}
        />

        <PdfCard
          title="General Rules Reference (Blue)"
          description="Agility, passing, interception, catching and dodging modifiers, the Injury,
            Weather and Kick-off tables, and the pre-/post-kick-off sequence."
          filename="LRB6-General.pdf"
          sizeLabel={generalSize}
        />

        <PdfCard
          title="Passing Reference (Green)"
          description="The Agility table, passing and skill modifiers, and the throwing-range
            diagrams for normal and Throw Team-Mate passes."
          filename="LRB6-Passing.pdf"
          sizeLabel={passingSize}
        />

        <PdfCard
          title="Teams Reference (Purple)"
          description="Full roster tables for every race — costs, stats, starting skills, and
            normal/doubles skill access."
          filename="LRB6-Teams.pdf"
          sizeLabel={teamsSize}
        />

        <PdfCard
          title="League Reference (Red)"
          description="The league match sequence, Fan Factor and Gate/FAME tables, the full
            Inducements table with rules text, the SPP and Value Modifier tables, and skill categories."
          filename="LRB6-League.pdf"
          sizeLabel={leagueSize}
        />

        {/* Special Play Cards */}
        <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50">
          <div className="px-6 py-5 border-b border-bb-border">
            <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase mb-1">
              Special Play Cards
            </h2>
            <p className="text-bb-muted text-sm">
              CRP1&apos;s optional Special Play Card decks, purchasable as a match inducement. Each
              deck costs gold to randomly draw one card. Expand a deck to see every card it holds.
            </p>
          </div>

          <div className="divide-y divide-bb-border/50">
            {decks.map((deck) => (
              <details key={deck.id} className="group">
                <summary className="flex items-center gap-3 px-6 py-3.5 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                  <svg className="w-3 h-3 shrink-0 text-bb-muted/60 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="font-heading font-bold text-white text-sm">{deck.name}</span>
                  <span className="text-bb-muted text-xs ml-auto">
                    {deck.cards.length} cards · {deck.price.toLocaleString()} gp/draw
                  </span>
                </summary>
                <div className="px-6 pb-5 pt-1 space-y-3 bg-bb-darker/30">
                  {deck.cards.map((card) => (
                    <div key={card.id} className="flex gap-3">
                      <span className="shrink-0 w-14 text-right font-mono text-xs text-bb-gold pt-0.5">{card.cardLabel}</span>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm text-white font-heading">{card.name}</p>
                        <p className="text-xs text-bb-muted leading-relaxed italic">{card.description}</p>
                        <p className="text-xs leading-relaxed">
                          <span className="text-bb-gold/80 font-heading uppercase tracking-wider text-[10px]">Timing — </span>
                          <span className="text-bb-muted">{card.timing}</span>
                        </p>
                        <p className="text-xs leading-relaxed">
                          <span className="text-bb-gold/80 font-heading uppercase tracking-wider text-[10px]">Effect — </span>
                          <span className="text-white/90">{card.effect}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>

        </div>{/* end flex col */}

      </div>
    </div>
  )
}
