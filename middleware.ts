import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { resolvePermissions, hasPermission, ROUTE_PERMISSION_MAP, type PermissionsMap } from '@/lib/permissions'

const PUBLIC_ROUTES = ['/login', '/cadastro', '/aceitar-convite']
const ADMIN_PREFIX = '/admin'
const INTERNO_PREFIX = '/interno'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip public routes, API, static assets
  if (
    PUBLIC_ROUTES.some(r => pathname.startsWith(r)) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Create Supabase client with cookie handling
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not authenticated → redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Admin/Interno routes are handled by their own layouts (profile.role check)
  if (pathname.startsWith(ADMIN_PREFIX) || pathname.startsWith(INTERNO_PREFIX)) {
    return response
  }

  // ── Permission check for student routes ──
  // Try to get cached permissions from cookie
  const permsCookie = request.cookies.get('bl_perms')?.value
  let perms: PermissionsMap | null = null

  if (permsCookie) {
    try {
      perms = JSON.parse(permsCookie) as PermissionsMap
    } catch {
      // Invalid cookie, will re-fetch
    }
  }

  // If no cached permissions, fetch from DB and set cookie
  if (!perms) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role, permissions')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (membership) {
      perms = resolvePermissions(
        membership.role,
        membership.permissions as Record<string, unknown> | null
      )
      // Cache in cookie for 5 minutes
      response.cookies.set('bl_perms', JSON.stringify(perms), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300, // 5 minutes
        path: '/',
      })
    }
  }

  // Check route against permission map
  if (perms) {
    // Find the matching route key (longest match first)
    const matchingRoute = Object.keys(ROUTE_PERMISSION_MAP)
      .filter(route => pathname.startsWith(route))
      .sort((a, b) => b.length - a.length)[0]

    if (matchingRoute) {
      const permKey = ROUTE_PERMISSION_MAP[matchingRoute]
      if (!hasPermission(perms, permKey)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
