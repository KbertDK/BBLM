'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MatchSummary } from '@/lib/types'

// ── Advert pool ───────────────────────────────────────────────────────────────
const ADVERTS = [
  '/adverts/7-Elven.jpg',
  '/adverts/abc.jpg',
  '/adverts/AirJordell.gif',
  '/adverts/BlockDodger.jpg',
  '/adverts/Bloodweiser.jpg',
  '/adverts/BoneheadedVideo.jpg',
  '/adverts/Bony.jpg',
  '/adverts/Cannon.jpg',
  '/adverts/Chanelf.jpg',
  '/adverts/ChoppersThugMart.jpg',
  '/adverts/DedBull.jpg',
  '/adverts/Dodge.jpg',
  '/adverts/Elf.jpg',
  '/adverts/Festers.jpg',
  '/adverts/Fjord.jpg',
  '/adverts/Foul.jpg',
  '/adverts/Frenzy.jpg',
  '/adverts/getref.gif',
  '/adverts/Gobbostopper.jpg',
  '/adverts/griffmovie.gif',
  '/adverts/Hurtz.jpg',
  '/adverts/Ikillya.jpg',
  '/adverts/Insanesburys.jpg',
  '/adverts/Jordell.jpg',
  '/adverts/Killers.jpg',
  '/adverts/Killtucky.jpg',
  '/adverts/Knuckleduster.jpg',
  '/adverts/McMutys.jpg',
  '/adverts/MGD.jpg',
  '/adverts/MightyBlow.jpg',
  '/adverts/MightyBlow-1.jpg',
  '/adverts/Nesquig.jpg',
  '/adverts/Ogre.jpg',
  '/adverts/OgreGuardian.jpg',
  '/adverts/orcacola.gif',
  '/adverts/Orcarade.jpg',
  '/adverts/orcidas.jpg',
  '/adverts/Orcsmobile.jpg',
  '/adverts/Orcswagon.jpg',
  '/adverts/orcwagen2.gif',
  '/adverts/Painasonic.jpg',
  '/adverts/Reeborc.jpg',
  '/adverts/Sabol.jpg',
  '/adverts/Scabidas.jpg',
  '/adverts/spikey.jpg',
  '/adverts/squigger.gif',
]

// ── Bar flavour text ──────────────────────────────────────────────────────────
const BAR_SLOGANS = [
  'WHERE BRUTALITY IS THE ENTERTAINMENT',
  "WE DON'T SERVE ELVES... ACTUALLY, WE DO — 3GP EXTRA",
  "DRINK UP. IT'S ONLY TEETH.",
  'NO REFUNDS ON BETS — THE REF IS OUR COUSIN',
  'BLOODWEISER ON TAP — STAY CLASSY, STAY DRUNK',
  "IF YOU DON'T BLEED, YOU'RE NOT TRYING HARD ENOUGH",
  'HOME OF THE MIGHTY BLOW SPECIAL — 2GP A PINT',
  'EST. THE YEAR OF THE GREAT PLAGUE — OR THEREABOUTS',
  'THE MANAGEMENT IS NOT RESPONSIBLE FOR MISSING LIMBS',
  'HALF-TIME ENTERTAINMENT: THE REF GETS PELTED',
]

const BAR_MENU = [
  '🍺 Bloodweiser Bucket — 2gp',
  '🦴 Goblin Goulash — 3gp',
  '🔥 Troll Toes (Deep Fried) — 4gp',
  '🍖 Half-Time Ogre Ribs — 5gp',
  '🧃 Orcarade Punch — 1gp',
  '☠ Death Wish Dip — 2gp',
  '🥩 Mystery Meat Skewers — 2gp (No Questions Asked)',
  "🫙 McMuty's Chunky Stew — 3gp",
  '🍻 Barrel of Ded Bull — 6gp (Serves 4, or 1 Ogre)',
  '🌶️ Spicy Skaven Sausage — 2gp',
]

const BAR_FILLER = [
  "Tonight's referee has been generously compensated. Results may vary.",
  'Please do not challenge the Ogre Bouncer. Last 3 who tried are MNG.',
  'Lost & Found: One iron boot, two teeth, a goblin. Enquire at the bar.',
  'The kitchen closes at the final whistle. Or when we run out of goblins.',
  "Today's special: 50% off if your team wins. No draws. No exceptions.",
  'Wi-Foul Password: BloodBowl1 — Free while your team is winning.',
  'Happy Hour: All pints 1gp. Until someone gets hurt. (So, not long.)',
  'Management not responsible for injuries sustained during excessive celebration.',
  'The Troll in the corner is a regular. Leave him alone. Seriously.',
  'Coach of the Match gets a free Bloodweiser. Losers pay double.',
]

const EVENT_ICON: Record<string, string> = {
  TD:           '🏈',
  CASUALTY:     '💀',
  INTERCEPTION: '🖐',
  HALFTIME:     '⛔',
}

// ── Advert / cycling hooks ────────────────────────────────────────────────────
const N = ADVERTS.length

function randomIdx(exclude?: number) {
  let i = Math.floor(Math.random() * N)
  if (exclude !== undefined && N > 1) {
    while (i === exclude) i = Math.floor(Math.random() * N)
  }
  return i
}

function useRotatingSlot(intervalMs: number) {
  const [index,   setIndex]   = useState<number>(() => randomIdx())
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIndex((prev) => randomIdx(prev)); setVisible(true) }, 400)
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return { src: ADVERTS[index], visible }
}

function useCycling<T>(items: T[], intervalMs: number): T {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), intervalMs)
    return () => clearInterval(id)
  }, [items.length, intervalMs])
  return items[idx]
}

// ── Sound helpers ─────────────────────────────────────────────────────────────
function getRoughMaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  const MALE = ['david', 'james', 'paul', 'george', 'mark', 'daniel', 'thomas',
                'eric', 'guy', 'male', 'reed', 'fred', 'bruce', 'ralph', 'albert', 'bad']
  return voices.find((v) => MALE.some((k) => v.name.toLowerCase().includes(k)))
      ?? voices.find((v) => v.lang.startsWith('en'))
      ?? voices[0]
      ?? null
}

function speakRough(text: string, rate: number, pitch: number, volume: number) {
  const u = new SpeechSynthesisUtterance(text)
  u.rate = rate; u.pitch = pitch; u.volume = volume
  const v = getRoughMaleVoice(); if (v) u.voice = v
  window.speechSynthesis.speak(u)
}

function speakTouchdown(detail: string) {
  if (typeof window === 'undefined') return
  window.speechSynthesis?.cancel()

  const audio = new Audio('/Sound/touchdown-unbelievable.mp3')
  audio.volume = 1
  audio.play().catch(() => {})
}

function speakCasualty(detail: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  speakRough('CASUALTY!', 0.55, 0, 1)
  if (detail) speakRough(detail, 0.65, 0, 0.9)
}

function playOrganAndSpeak(detail: string) {
  // Synthesise a dramatic diminished organ chord using the Web Audio API
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext
    if (AC) {
      const ctx: AudioContext = new AC()
      // Two chords: diminished (B2-D3-F3) → resolve down (G2-Bb2-D3)
      const chords = [
        [123.47, 146.83, 174.61],  // B2 D3 F3  — ominous
        [97.999, 116.54, 146.83],  // G2 Bb2 D3 — sombre resolution
      ]
      chords.forEach((freqs, beat) => {
        freqs.forEach((f) => {
          const osc  = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sawtooth'          // organ-like timbre
          osc.frequency.value = f
          const t = ctx.currentTime + beat * 1.7
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.16, t + 0.09)
          gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6)
          osc.connect(gain); gain.connect(ctx.destination)
          osc.start(t); osc.stop(t + 1.7)
        })
      })
    }
  } catch { /* AudioContext blocked — fall through */ }

  // Speech after organ intro
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
    setTimeout(() => {
      speakRough('A player has fallen.', 0.45, 0, 1)
      if (detail) setTimeout(() => speakRough(detail, 0.6, 0, 0.9), 1400)
    }, 800)
  }
}

// ── Unified flash state ───────────────────────────────────────────────────────
type FlashKind = 'TD' | 'KILL' | 'CAS'

interface Flash {
  kind:          FlashKind
  eventLabel:    string
  homeTeamName:  string
  awayTeamName:  string
  homeScore:     number
  awayScore:     number
  homeCasScore:  number
  awayCasScore:  number
  homeKillScore: number
  awayKillScore: number
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  initialMatches: MatchSummary[]
}

export default function SportBarScoreboard({ initialMatches }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => startTransition(() => { router.refresh() }), 30_000)
    return () => clearInterval(id)
  }, [router])

  // ── Event flash detection ─────────────────────────────────────────────────
  const [flash,  setFlash]  = useState<Flash | null>(null)
  const [fading, setFading] = useState(false)

  const prevTDsRef = useRef(
    new Map(initialMatches.map((m) => [m.id, (m.homeScore ?? 0) + (m.awayScore ?? 0)]))
  )
  const prevKillsRef = useRef(
    new Map(initialMatches.map((m) => [m.id, (m.homeKillScore ?? 0) + (m.awayKillScore ?? 0)]))
  )
  const prevCasRef = useRef(
    new Map(initialMatches.map((m) => [
      m.id,
      ((m.homeCasScore ?? 0) + (m.awayCasScore ?? 0)) - ((m.homeKillScore ?? 0) + (m.awayKillScore ?? 0)),
    ]))
  )

  useEffect(() => {
    let detected: Flash | null = null

    for (const m of initialMatches) {
      const base = {
        homeTeamName:  m.homeTeamName,
        awayTeamName:  m.awayTeamName,
        homeScore:     m.homeScore     ?? 0,
        awayScore:     m.awayScore     ?? 0,
        homeCasScore:  m.homeCasScore  ?? 0,
        awayCasScore:  m.awayCasScore  ?? 0,
        homeKillScore: m.homeKillScore ?? 0,
        awayKillScore: m.awayKillScore ?? 0,
      }
      const currKills = base.homeKillScore + base.awayKillScore
      const currTDs   = base.homeScore     + base.awayScore
      const currCas   = (base.homeCasScore + base.awayCasScore) - currKills

      if (currKills > (prevKillsRef.current.get(m.id) ?? 0)) {
        const ev = m.recentEvents?.find((e) => e.type === 'CASUALTY' && e.label.endsWith('[DEAD]'))
        detected = { kind: 'KILL', eventLabel: ev?.label ?? 'A player has been slain!', ...base }
        break
      }
      if (currTDs > (prevTDsRef.current.get(m.id) ?? 0)) {
        const ev = m.recentEvents?.find((e) => e.type === 'TD')
        detected = { kind: 'TD', eventLabel: ev?.label ?? 'TOUCHDOWN!', ...base }
        break
      }
      if (currCas > (prevCasRef.current.get(m.id) ?? 0)) {
        const ev = m.recentEvents?.find(
          (e) => e.type === 'CASUALTY' && !e.label.endsWith('[KO]') && !e.label.endsWith('[DEAD]')
        )
        detected = { kind: 'CAS', eventLabel: ev?.label ?? 'CASUALTY!', ...base }
        break
      }
    }

    if (detected) {
      setFlash(detected); setFading(false)
      if      (detected.kind === 'TD')   speakTouchdown(detected.eventLabel)
      else if (detected.kind === 'KILL') playOrganAndSpeak(detected.eventLabel)
      else if (detected.kind === 'CAS')  speakCasualty(detected.eventLabel)
    }

    prevTDsRef.current   = new Map(initialMatches.map((m) => [m.id, (m.homeScore ?? 0) + (m.awayScore ?? 0)]))
    prevKillsRef.current = new Map(initialMatches.map((m) => [m.id, (m.homeKillScore ?? 0) + (m.awayKillScore ?? 0)]))
    prevCasRef.current   = new Map(initialMatches.map((m) => [
      m.id,
      ((m.homeCasScore ?? 0) + (m.awayCasScore ?? 0)) - ((m.homeKillScore ?? 0) + (m.awayKillScore ?? 0)),
    ]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMatches])

  // Auto-dismiss after 5s
  useEffect(() => {
    if (!flash) return
    const fade = setTimeout(() => setFading(true),  4_500)
    const hide = setTimeout(() => { setFlash(null); setFading(false) }, 5_000)
    return () => { clearTimeout(fade); clearTimeout(hide) }
  }, [flash])

  function dismiss() {
    window.speechSynthesis?.cancel()
    setFlash(null); setFading(false)
  }

  // ── Rotating panels ───────────────────────────────────────────────────────
  const leftAd   = useRotatingSlot(7_000)
  const rightAd  = useRotatingSlot(9_000)
  const slogan   = useCycling(BAR_SLOGANS, 8_000)
  const menuItem = useCycling(BAR_MENU, 12_000)

  const [sloganVisible, setSloganVisible] = useState(true)
  const [prevSlogan,    setPrevSlogan]    = useState(slogan)

  useEffect(() => {
    if (slogan !== prevSlogan) {
      setSloganVisible(false)
      const t = setTimeout(() => { setPrevSlogan(slogan); setSloganVisible(true) }, 300)
      return () => clearTimeout(t)
    }
  }, [slogan, prevSlogan])

  // ── Ticker ────────────────────────────────────────────────────────────────
  const tickerItems: string[] = []
  for (const m of initialMatches) {
    const events = m.allEvents ?? m.recentEvents ?? []
    if (events.length > 0) {
      tickerItems.push(`⚔ ${m.homeTeamName.toUpperCase()} VS ${m.awayTeamName.toUpperCase()} ⚔`)
      for (const ev of events) tickerItems.push(`${EVENT_ICON[ev.type] ?? '•'} ${ev.label}`)
    }
  }
  tickerItems.push(...BAR_FILLER)
  const SEP = '                    ⚔                    '
  const tickerString = tickerItems.join(SEP)

  const matches = initialMatches

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
      style={{ background: '#080604', fontFamily: 'var(--font-cinzel), Georgia, serif' }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-bb-gold/30 bg-black/60 backdrop-blur-sm px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-bb-gold font-heading font-black text-lg md:text-2xl tracking-widest uppercase whitespace-nowrap">
            Reikland Rumble
          </span>
          <span className="hidden sm:block text-bb-muted/40 text-xl">·</span>
          <span className="hidden sm:block text-bb-muted text-xs tracking-widest uppercase">Live Scoreboard</span>
        </div>
        <div className="flex-1 text-center overflow-hidden px-4">
          <span
            className="font-heading text-[10px] sm:text-xs tracking-widest uppercase text-bb-gold/60 transition-opacity duration-300"
            style={{ opacity: sloganVisible ? 1 : 0 }}
          >{prevSlogan}</span>
        </div>
        <div className="shrink-0">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-bb-crimson/20 border border-bb-crimson/50 rounded-sm">
            <span className="w-2 h-2 rounded-full bg-bb-crimson-bright animate-pulse-live" />
            <span className="font-heading text-[11px] tracking-widest text-bb-crimson-bright uppercase">Live</span>
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT AD */}
        <aside className="hidden lg:flex w-44 xl:w-56 shrink-0 flex-col items-center justify-center gap-4 border-r border-bb-gold/10 bg-black/20 p-3">
          <div
            className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-sm border border-bb-gold/20 bg-bb-darker transition-opacity duration-500"
            style={{ opacity: leftAd.visible ? 1 : 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={leftAd.src} alt="sponsor" className="max-h-full max-w-full object-contain" />
          </div>
          <p className="font-heading text-[9px] tracking-widest uppercase text-bb-gold/30">Official Sponsor</p>
          <div className="mt-auto w-full border-t border-bb-gold/10 pt-3 text-center space-y-0.5">
            <p className="font-heading text-[9px] tracking-widest uppercase text-bb-muted/40">Established</p>
            <p className="font-heading text-[10px] text-bb-gold/40">Year of the Great Plague</p>
            <p className="font-heading text-[8px] text-bb-muted/20 uppercase tracking-widest">or thereabouts</p>
          </div>
        </aside>

        {/* CENTER */}
        <main className="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col justify-center">
          {matches.length === 0 ? (
            <EmptyState />
          ) : (
            <div className={[
              'w-full h-full',
              matches.length === 1
                ? 'flex items-center justify-center'
                : matches.length === 2
                  ? 'grid grid-cols-2 gap-4 items-center'
                  : 'grid grid-cols-2 xl:grid-cols-3 gap-3 items-start',
            ].join(' ')}>
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} compact={matches.length > 1} />
              ))}
            </div>
          )}
        </main>

        {/* RIGHT AD + MENU */}
        <aside className="hidden lg:flex w-44 xl:w-56 shrink-0 flex-col items-center justify-center gap-4 border-l border-bb-gold/10 bg-black/20 p-3">
          <div
            className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-sm border border-bb-gold/20 bg-bb-darker transition-opacity duration-500"
            style={{ opacity: rightAd.visible ? 1 : 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={rightAd.src} alt="sponsor" className="max-h-full max-w-full object-contain" />
          </div>
          <p className="font-heading text-[9px] tracking-widest uppercase text-bb-gold/30">Official Sponsor</p>
          <div className="w-full border-t border-bb-gold/10 pt-3">
            <p className="font-heading text-[9px] tracking-widest uppercase text-bb-gold/30 mb-2 text-center">Tonight&apos;s Special</p>
            <div className="bg-bb-crimson/10 border border-bb-crimson/30 rounded-sm px-2 py-2 text-center">
              <p className="font-heading text-[11px] text-bb-gold leading-snug tracking-wide">{menuItem}</p>
            </div>
          </div>
          <div className="mt-auto text-center">
            <p className="font-heading text-[9px] tracking-widest uppercase text-bb-muted/25">No weapons at the bar</p>
            <p className="font-heading text-[8px] text-bb-muted/15 tracking-widest uppercase">(mostly)</p>
          </div>
        </aside>
      </div>

      {/* ── TICKER ─────────────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-bb-gold/30 bg-black/70 py-2 overflow-hidden">
        <div className="whitespace-nowrap overflow-hidden">
          <span className="inline-block animate-marquee font-heading text-[11px] tracking-widest uppercase text-bb-gold/70">
            {tickerString + SEP + tickerString}
          </span>
        </div>
      </footer>

      {/* ── EVENT OVERLAYS ─────────────────────────────────────────────────── */}
      {flash && <EventOverlay flash={flash} fading={fading} onDismiss={dismiss} />}
    </div>
  )
}

// ── Event overlay (TD / Kill / CAS) ──────────────────────────────────────────
function EventOverlay({ flash, fading, onDismiss }: {
  flash:     Flash
  fading:    boolean
  onDismiss: () => void
}) {
  const cfg = {
    TD: {
      bg:         'radial-gradient(ellipse at center, rgba(201,162,39,0.20) 0%, rgba(8,6,4,0.97) 65%)',
      ringColor:  'border-bb-gold/25',
      emoji:      '🏈',
      heading:    'TOUCH\nDOWN!',
      headingCss: { color: '#c9a227', textShadow: '0 0 60px rgba(201,162,39,0.9), 0 0 120px rgba(201,162,39,0.5)' },
      subLine:    `${flash.homeTeamName} ${flash.homeScore} — ${flash.awayScore} ${flash.awayTeamName}`,
      subColor:   'text-bb-gold/60',
    },
    KILL: {
      bg:         'radial-gradient(ellipse at center, rgba(80,0,120,0.30) 0%, rgba(4,2,8,0.97) 65%)',
      ringColor:  'border-purple-500/20',
      emoji:      '🪦',
      heading:    'R.I.P.',
      headingCss: { color: '#d4c5e2', textShadow: '0 0 60px rgba(140,60,200,0.8), 0 0 120px rgba(80,0,120,0.6)' },
      subLine:    `☠ ${flash.homeKillScore + flash.awayKillScore} ${flash.homeKillScore + flash.awayKillScore === 1 ? 'kill' : 'kills'} this match`,
      subColor:   'text-purple-300/60',
    },
    CAS: {
      bg:         'radial-gradient(ellipse at center, rgba(139,0,0,0.35) 0%, rgba(8,2,2,0.97) 65%)',
      ringColor:  'border-bb-crimson/30',
      emoji:      '💀',
      heading:    'CASUALTY!',
      headingCss: { color: '#c0392b', textShadow: '0 0 60px rgba(192,57,43,0.9), 0 0 120px rgba(139,0,0,0.6)' },
      subLine:    `💀 ${flash.homeCasScore} — ${flash.awayCasScore} 💀`,
      subColor:   'text-bb-crimson-bright/60',
    },
  }[flash.kind]

  const lines = cfg.heading.split('\n')

  return (
    <div
      className="absolute inset-0 z-[99999] flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ background: cfg.bg, animation: fading ? 'td-fade-out 0.5s ease-in forwards' : undefined }}
      onClick={onDismiss}
    >
      {/* Pulsing ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-[32rem] h-[32rem] rounded-full border ${cfg.ringColor} animate-ping`}
          style={{ animationDuration: '1.3s' }}
        />
      </div>

      {/* Content */}
      <div
        className="relative text-center px-8 max-w-3xl"
        style={{ animation: 'td-blast 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
      >
        <div className="text-7xl md:text-8xl mb-3">{cfg.emoji}</div>

        <h1
          className="font-heading font-black tracking-widest uppercase leading-none"
          style={{ fontSize: 'clamp(3.5rem, 13vw, 10rem)', ...cfg.headingCss }}
        >
          {lines.map((line, i) => (
            <span key={i}>{line}{i < lines.length - 1 && <br />}</span>
          ))}
        </h1>

        <p className="font-heading text-xl md:text-3xl text-white tracking-widest uppercase mt-6 leading-snug">
          {flash.eventLabel}
        </p>

        <p className={`mt-4 font-heading text-base md:text-lg tracking-widest uppercase ${cfg.subColor}`}>
          {cfg.subLine}
        </p>

        <p className="mt-10 font-heading text-xs text-bb-muted/30 tracking-widest uppercase">Tap to dismiss</p>
      </div>
    </div>
  )
}

// ── Match Score Card ──────────────────────────────────────────────────────────
function MatchCard({ match: m, compact }: { match: MatchSummary; compact: boolean }) {
  return (
    <div className="w-full border border-bb-gold/30 bg-black/40 rounded-sm overflow-hidden">
      <div className="bg-bb-gold/10 border-b border-bb-gold/20 px-4 py-1.5 text-center">
        <span className="font-heading text-[10px] tracking-widest uppercase text-bb-gold/50">
          Round {m.round} · Game On
        </span>
      </div>
      <div className={compact ? 'px-4 py-4' : 'px-6 py-8'}>
        {/* Team names */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 text-center">
            <p className={['font-heading font-black text-white tracking-widest uppercase leading-tight',
              compact ? 'text-xs md:text-sm' : 'text-sm md:text-base lg:text-lg'].join(' ')}>
              {m.homeTeamName}
            </p>
          </div>
          <div className="shrink-0 font-heading text-bb-muted/30 text-sm">VS</div>
          <div className="flex-1 text-center">
            <p className={['font-heading font-black text-white tracking-widest uppercase leading-tight',
              compact ? 'text-xs md:text-sm' : 'text-sm md:text-base lg:text-lg'].join(' ')}>
              {m.awayTeamName}
            </p>
          </div>
        </div>
        {/* TD scores */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 text-center">
            <span className={['font-heading font-black text-bb-gold leading-none tabular-nums',
              compact ? 'text-5xl md:text-6xl lg:text-7xl' : 'text-7xl md:text-8xl lg:text-9xl'].join(' ')}>
              {m.homeScore ?? 0}
            </span>
          </div>
          <div className="shrink-0 text-center">
            <div className="font-heading text-[9px] tracking-widest text-bb-muted/40 uppercase mb-0.5">TD</div>
            <div className={compact ? 'text-lg' : 'text-2xl'}>🏈</div>
          </div>
          <div className="flex-1 text-center">
            <span className={['font-heading font-black text-bb-gold leading-none tabular-nums',
              compact ? 'text-5xl md:text-6xl lg:text-7xl' : 'text-7xl md:text-8xl lg:text-9xl'].join(' ')}>
              {m.awayScore ?? 0}
            </span>
          </div>
        </div>
        {/* CAS */}
        <div className="flex items-center gap-3 mb-1.5">
          <div className="flex-1 text-center">
            <span className={['font-heading font-black text-bb-crimson-bright tabular-nums',
              compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'].join(' ')}>
              {m.homeCasScore ?? 0}
            </span>
          </div>
          <div className="shrink-0 text-center font-heading text-[9px] tracking-widest text-bb-muted/40 uppercase">💀 CAS</div>
          <div className="flex-1 text-center">
            <span className={['font-heading font-black text-bb-crimson-bright tabular-nums',
              compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'].join(' ')}>
              {m.awayCasScore ?? 0}
            </span>
          </div>
        </div>
        {/* Kills */}
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center">
            <span className={['font-heading font-bold text-bb-muted tabular-nums',
              compact ? 'text-base' : 'text-xl'].join(' ')}>
              {m.homeKillScore ?? 0}
            </span>
          </div>
          <div className="shrink-0 text-center font-heading text-[9px] tracking-widest text-bb-muted/40 uppercase">☠ Kills</div>
          <div className="flex-1 text-center">
            <span className={['font-heading font-bold text-bb-muted tabular-nums',
              compact ? 'text-base' : 'text-xl'].join(' ')}>
              {m.awayKillScore ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-16 px-4 w-full">
      <div className="text-6xl mb-6">🍺</div>
      <h2 className="font-heading text-2xl md:text-4xl font-black text-bb-gold/60 tracking-widest uppercase mb-3">
        The Pitch Is Quiet
      </h2>
      <p className="font-heading text-sm tracking-widest text-bb-muted/50 uppercase mb-2">No Matches In Progress</p>
      <p className="font-heading text-xs tracking-widest text-bb-muted/30 uppercase mt-8">
        Settle in. Have a Bloodweiser. It won&apos;t be quiet for long.
      </p>
      <div className="mt-12 flex items-center justify-center gap-4">
        <div className="h-px flex-1 max-w-24 bg-bb-gold/10" />
        <span className="font-heading text-[10px] tracking-widest text-bb-gold/20 uppercase">⚔ Reikland Rumble League ⚔</span>
        <div className="h-px flex-1 max-w-24 bg-bb-gold/10" />
      </div>
    </div>
  )
}
