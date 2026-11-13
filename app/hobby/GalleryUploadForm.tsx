'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { uploadGalleryPost } from './actions'

export default function GalleryUploadForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef  = useRef<HTMLFormElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await uploadGalleryPost(fd)
      if (result?.error) {
        setError(result.error)
        return
      }
      formRef.current?.reset()
      setFileName(null)
      router.refresh()
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-bb-dark border border-bb-border rounded-sm p-5 space-y-3"
    >
      <p className="text-xs font-heading uppercase tracking-widest text-bb-gold">Add a Picture</p>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        className="w-full border-2 border-dashed border-bb-border hover:border-bb-gold/50 rounded-sm px-4 py-6 text-center text-bb-muted/70 hover:text-bb-gold/80 transition-colors text-sm"
      >
        {fileName ?? 'Choose a picture…'}
      </button>
      <input
        ref={fileRef}
        type="file"
        name="image"
        accept="image/*"
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />

      <textarea
        name="description"
        required
        maxLength={500}
        rows={3}
        placeholder="Tell us about this picture…"
        className="w-full bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white placeholder:text-bb-muted/40 focus:outline-none focus:border-bb-gold resize-none"
      />

      {error && <p className="text-xs text-bb-crimson-bright">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 rounded-sm border border-bb-gold/50 bg-bb-gold/10 text-bb-gold text-xs font-heading uppercase tracking-widest hover:bg-bb-gold hover:text-bb-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? 'Uploading…' : 'Add to Gallery'}
      </button>
    </form>
  )
}
