export const metadata = { title: 'Rules — Blood Bowl League Manager' }

export default function RulesPage() {
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

        {/* LRB6 */}
        <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50">
          <div className="px-6 py-5 border-b border-bb-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase mb-1">
                  Living Rulebook 6
                </h2>
                <p className="text-bb-muted text-sm">
                  The comprehensive Blood Bowl rulebook — LRB6, the definitive edition used
                  by this league. Covers all rules, rosters, star players, special play cards,
                  and league management.
                </p>
              </div>
              <div className="text-bb-muted/40 text-xs shrink-0 pt-1">PDF · 24.7 MB</div>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center gap-4">
            <a
              href="/LRB6.pdf"
              download="LRB6.pdf"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold uppercase tracking-widest text-xs rounded-sm border border-bb-crimson-bright/50 transition-all shadow-lg shadow-bb-crimson/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download LRB6
            </a>
            <a
              href="/LRB6.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-bb-muted border border-bb-border hover:text-bb-gold hover:border-bb-gold/50 font-heading font-bold uppercase tracking-widest text-xs rounded-sm transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in browser
            </a>
          </div>
        </div>

        {/* CRP1 */}
        <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50">
          <div className="px-6 py-5 border-b border-bb-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase mb-1">
                  Competition Rules Pack 1
                </h2>
                <p className="text-bb-muted text-sm">
                  Official Blood Bowl competition rules supplement — CRP1. Covers tournament
                  formats, additional rosters, star players, and event guidelines for organised play.
                </p>
              </div>
              <div className="text-bb-muted/40 text-xs shrink-0 pt-1">PDF · 5.3 MB</div>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center gap-4">
            <a
              href="/CRP1.pdf"
              download="CRP1.pdf"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold uppercase tracking-widest text-xs rounded-sm border border-bb-crimson-bright/50 transition-all shadow-lg shadow-bb-crimson/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download CRP1
            </a>
            <a
              href="/CRP1.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-bb-muted border border-bb-border hover:text-bb-gold hover:border-bb-gold/50 font-heading font-bold uppercase tracking-widest text-xs rounded-sm transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in browser
            </a>
          </div>
        </div>

        </div>{/* end flex col */}

      </div>
    </div>
  )
}
