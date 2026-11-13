'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteGalleryPost } from './actions'

export default function DeleteGalleryButton({
  postId, redirectTo, className,
}: {
  postId:     string
  redirectTo?: string
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!window.confirm('Delete this picture? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteGalleryPost(postId)
      if (result?.error) { window.alert(result.error); return }
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className={className ?? 'text-[11px] text-bb-crimson-bright hover:text-bb-crimson transition-colors disabled:opacity-40'}
    >
      {isPending ? 'Deleting…' : '✕ Delete'}
    </button>
  )
}
