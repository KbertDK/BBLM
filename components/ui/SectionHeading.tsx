interface SectionHeadingProps {
  title: string
  subtitle?: string
}

export default function SectionHeading({ title, subtitle }: SectionHeadingProps) {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center gap-4 justify-center mb-2">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-bb-gold/60 max-w-32" />
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-bb-gold tracking-widest uppercase">
          {title}
        </h2>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-bb-gold/60 max-w-32" />
      </div>
      {subtitle && (
        <p className="text-bb-muted text-sm tracking-wide">{subtitle}</p>
      )}
    </div>
  )
}
