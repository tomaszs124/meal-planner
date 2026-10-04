import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/lib/env'

/**
 * Auth gate (Next.js 16 "proxy", formerly middleware): refreshes the Supabase
 * session cookie and redirects anonymous visitors to /login.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get user from Supabase Auth
  const { data: { user } } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/reset-password']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // If user is not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is logged in and trying to access login page
  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

// Configure which routes to run the proxy on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest / icons / public assets
     * - api/mcp (MCP connector endpoint, authenticated by its own token)
     * - sw.js (service worker script; must never be redirected to /login)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js$|icon-|api/mcp|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
