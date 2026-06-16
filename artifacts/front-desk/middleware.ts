import { NextRequest, NextResponse } from 'next/server';

// Protected patient-portal paths — require a valid session cookie.
// Public paths (login, OTP callback, public intake) are excluded.
const PATIENT_PUBLIC = [
  '/patient/login',
  '/patient/auth',
];

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Only gate /patient/* routes
  if (!pathname.startsWith('/patient')) return NextResponse.next();

  // Allow public paths and their sub-routes
  if (PATIENT_PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow the portal root (shows login CTA when not authed)
  if (pathname === '/patient') return NextResponse.next();

  // Check for Supabase session cookie — the cookie name mirrors the storageKey
  // used in patient-supabase.ts (`amise-patient-session`).
  const sessionCookie =
    req.cookies.get('amise-patient-session') ??
    req.cookies.get('sb-access-token') ??
    // Supabase stores the session as `sb-<project-ref>-auth-token`
    [...req.cookies.getAll()].find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

  if (!sessionCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/patient/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/patient/:path*'],
};
