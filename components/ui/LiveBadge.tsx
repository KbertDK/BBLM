export default function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-bb-crimson/20 border border-bb-crimson-bright/40">
      <span className="w-1.5 h-1.5 rounded-full bg-bb-crimson-bright animate-pulse-live" />
      <span className="text-bb-crimson-bright text-xs font-bold tracking-widest uppercase">Live</span>
    </span>
  )
}
