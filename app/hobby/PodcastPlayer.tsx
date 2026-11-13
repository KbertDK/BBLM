'use client'

import { useEffect, useRef, useState } from 'react'
import { episodes, PODCAST_DIR } from './episodes'

const LOGO_SRC = encodeURI(`${PODCAST_DIR}/Folder.jpg`)

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  initialIndex?: number
  initialTime?:  number
  showPopOut?:   boolean
}

export default function PodcastPlayer({ initialIndex = 0, initialTime = 0, showPopOut = true }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [index, setIndex]       = useState(() => Math.min(Math.max(initialIndex, 0), episodes.length - 1))
  const [playing, setPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const current = episodes[index]
  const src     = encodeURI(`${PODCAST_DIR}/${current.file}`)

  // Reload the audio element whenever the track changes, resuming playback if it was playing.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.load()
    if (index === initialIndex && initialTime > 0) {
      audio.currentTime = initialTime
    }
    if (playing) audio.play().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else audio.play().catch(() => {})
  }

  function selectEpisode(i: number) {
    if (i === index) { togglePlay(); return }
    setPlaying(true)
    setIndex(i)
  }

  function handleEnded() {
    if (index < episodes.length - 1) {
      setPlaying(true)
      setIndex(index + 1)
    } else {
      setPlaying(false)
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct  = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    audio.currentTime = pct * duration
  }

  function handlePopOut() {
    const audio = audioRef.current
    audio?.pause()
    const t = Math.floor(audio?.currentTime ?? 0)
    window.open(
      `/hobby/player?ep=${index}&t=${t}`,
      'tzr-player',
      'width=400,height=560,resizable=yes,scrollbars=yes',
    )
  }

  return (
    <div className="bg-bb-dark border border-bb-border rounded-sm overflow-hidden max-w-2xl mx-auto">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Now Playing */}
      <div className="flex items-center gap-4 p-4 border-b border-bb-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="Tackle Zone Radio" className="w-14 h-14 object-contain rounded-sm border border-bb-border shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-heading uppercase tracking-widest text-bb-gold/60 mb-0.5">Now Playing</p>
          <p className="text-sm text-white truncate">{current.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showPopOut && (
            <button
              onClick={handlePopOut}
              title="Keep listening while doing something else — pop the player out"
              className="w-9 h-9 rounded-sm border border-bb-border text-bb-muted hover:text-bb-gold hover:border-bb-gold/40 transition-colors flex items-center justify-center text-sm"
            >
              ↗
            </button>
          )}
          <button
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="w-10 h-10 rounded-full bg-bb-gold text-bb-dark flex items-center justify-center hover:bg-bb-gold/80 transition-colors text-sm"
          >
            {playing ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3">
        <div onClick={handleSeek} className="h-1.5 bg-bb-darker rounded-full cursor-pointer relative overflow-hidden">
          <div className="h-full bg-bb-gold" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-bb-muted/60 mt-1 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playlist */}
      <div className="px-2 py-2">
        {episodes.map((ep, i) => (
          <button
            key={ep.file}
            onClick={() => selectEpisode(i)}
            className={`w-full text-left px-3 py-2 rounded-sm text-sm flex items-center gap-2.5 transition-colors ${
              i === index ? 'text-bb-gold bg-bb-gold/10' : 'text-bb-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-xs w-4 shrink-0 text-center">{i === index && playing ? '♪' : i + 1}</span>
            <span className="truncate">{ep.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
