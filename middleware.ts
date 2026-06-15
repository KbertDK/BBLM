import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export const config = {
  matcher: ['/teams/:path+', '/league-management', '/league-management/:path*', '/profile', '/data-manager'],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('bb_session')?.value
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET)

  const redirectToLogin = () => {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (!token) return redirectToLogin()

  try {
    const { payload } = await jwtVerify(token, secret)

    if (pathname.startsWith('/league-management')) {
      const role = payload['role'] as string | undefined
      if (role !== 'ADMIN' && role !== 'COMMISH') {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }

    if (pathname.startsWith('/data-manager')) {
      const role = payload['role'] as string | undefined
      if (role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }

    return NextResponse.next()
  } catch {
    return redirectToLogin()
  }
}
