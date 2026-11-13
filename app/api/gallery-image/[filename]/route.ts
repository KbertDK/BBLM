import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const CONTENT_TYPES: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
}

// Serves gallery uploads from a non-public directory, read fresh on every request.
// Next.js's production server (`next start`) snapshots public/ at boot for performance,
// so files written there at runtime (after the server is already running) 404 until
// the process restarts — a real static-asset limitation, not something retries fix.
// A dynamic route handler has no such snapshot; it always reads the current file.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params

  // Reject anything that isn't a bare filename (no path traversal).
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const ext = path.extname(filename).slice(1).toLowerCase()
  const contentType = CONTENT_TYPES[ext]
  if (!contentType) return new NextResponse('Not found', { status: 404 })

  const filepath = path.join(process.cwd(), 'uploads', 'gallery', filename)

  try {
    const data = await fs.readFile(filepath)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type':  contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
