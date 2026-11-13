'use client'

import { useState } from 'react'

// Browsers never automatically retry a failed <img> load, even if the resource becomes
// fetchable moments later (e.g. right at the edge of an upload completing). Retry a few
// times with backoff instead of leaving a freshly-uploaded picture stuck looking broken.
export default function GalleryImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed]   = useState(false)

  function handleError() {
    if (attempt >= 4) { setFailed(true); return }
    setTimeout(() => setAttempt((a) => a + 1), 600 * (attempt + 1))
  }

  if (failed) {
    return (
      <div className={`${className ?? ''} flex items-center justify-center bg-bb-darker text-bb-muted/50 text-xs italic`}>
        Picture failed to load
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={attempt}
      src={attempt === 0 ? src : `${src}?retry=${attempt}`}
      alt={alt}
      className={className}
      onError={handleError}
    />
  )
}
