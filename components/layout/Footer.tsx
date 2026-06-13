export default function Footer() {
  return (
    <footer className="bg-bb-darker mt-16">
      <div className="h-px bg-gradient-to-r from-transparent via-bb-gold/40 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 py-10 text-center">
        <div className="font-heading text-bb-gold text-lg tracking-widest uppercase mb-1">
          The Reikland Rumble League
        </div>
        <div className="text-bb-muted text-xs tracking-wide mb-4">Season 1 — May the best team survive</div>
        <div className="flex justify-center gap-1 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="text-bb-gold/30 text-xs">✦</span>
          ))}
        </div>
        <p className="text-bb-muted/50 text-xs">
          Blood Bowl League Manager &copy; {new Date().getFullYear()} — Powered by Next.js &amp; Prisma
        </p>
      </div>
    </footer>
  )
}
