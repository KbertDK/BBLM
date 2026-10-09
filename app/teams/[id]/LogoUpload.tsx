'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadTeamLogo } from './actions'

interface Props {
  teamId:      string
  currentLogo: string | null
  raceName:    string
  isOwner:     boolean
}

export default function LogoUpload({ teamId, currentLogo, raceName, isOwner }: Props) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const fd = new FormData()
    fd.set('teamId', teamId)
    fd.set('logo', file)

    startTransition(async () => {
      const result = await uploadTeamLogo(fd)
      if (result?.error) setError(result.error)
      // On success, revalidatePath in the action triggers a server re-render with the new logo
    })
  }

  if (!currentLogo) {
    // No logo at all — owner still sees an upload placeholder
    if (!isOwner) return null
    return (
      <div className="shrink-0 hidden sm:flex flex-col items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="w-44 h-44 border-2 border-dashed border-bb-border hover:border-bb-gold/50 rounded-sm flex flex-col items-center justify-center gap-2 text-bb-muted/50 hover:text-bb-gold/70 transition-colors cursor-pointer"
        >
          <CameraIcon />
          <span className="text-[10px] font-heading tracking-widest uppercase">Upload logo</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
        {error && <p className="text-xs text-bb-crimson-bright text-center max-w-[11rem]">{error}</p>}
      </div>
    )
  }

  return (
    <div className="shrink-0 hidden sm:flex flex-col items-center gap-1.5">
      <div className={`relative group ${isOwner ? 'cursor-pointer' : ''}`} onClick={() => isOwner && fileRef.current?.click()}>
        {/* Logo image */}
        <img
          src={currentLogo}
          alt={raceName}
          className="w-44 h-44 object-contain opacity-90 select-none"
        />

        {/* Pending spinner overlay */}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-sm">
            <svg className="w-8 h-8 animate-spin text-bb-gold" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {/* Owner hover overlay */}
        {isOwner && !isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm">
            <CameraIcon />
            <span className="text-[10px] font-heading tracking-widest uppercase text-white">Change logo</span>
          </div>
        )}
      </div>

      {isOwner && (
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      )}
      {error && <p className="text-xs text-bb-crimson-bright text-center max-w-[11rem]">{error}</p>}
    </div>
  )
}

function CameraIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
