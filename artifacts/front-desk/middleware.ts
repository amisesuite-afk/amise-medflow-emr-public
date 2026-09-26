import { NextRequest, NextResponse } from 'next/server';

const PATIENT_PUBLIC = ['/patient/login', '/patient/auth'];
const STAFF_PUBLIC   = ['/staff/login'];
// Same name as STAFF_SESSION_COOKIE in lib/staff-auth.ts (kept local so the
// edge middleware bundle doesn't import the service-role client module).
const STAFF_SESSION_COOKIE = 'amise-staff-session';

function hasSessionCookie(req: NextRequest, storageKey: string): boolean {
  if (req.cookies.get(storageKey)) return true;
  if (req.cookies.get('sb-access-token')) return true;
  return !!([...req.cookies.getAll()].find(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'),
  ));
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // ── Patient portal ───────────────────────────────────────────────────────────
  if (pathname.startsWith('/patient')) {
    if (PATIENT_PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
    if (pathname === '/patient') return NextResponse.next();
    if (!hasSessionCookie(req, 'amise-patient-session')) {
      const url = req.nextUrl.clone();
      url.pathname = '/patient/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Staff scheduling ─────────────────────────────────────────────────────────
  // Presence check only — a cheap redirect to the login page. It is NOT an
  // auth decision: the staff pages hold no data themselves, and every
  // /api/staff/* handler verifies the token with Supabase and requires a staff
  // user_profiles role (lib/staff-auth.ts → requireStaff). Only the staff
  // cookie counts here; the generic sb-*-auth-token fallbacks would also match
  // a patient-portal session.
  if (pathname.startsWith('/staff')) {
    if (STAFF_PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
    if (!req.cookies.get(STAFF_SESSION_COOKIE)?.value) {
      const url = req.nextUrl.clone();
      url.pathname = '/staff/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Staff API routes ─────────────────────────────────────────────────────────
  // Early 401 when there is no credential at all. The real check — token
  // validated with Supabase + staff role — happens in each route handler via
  // requireStaff(), because these routes use the service-role client.
  if (pathname.startsWith('/api/staff/')) {
    const hasBearer = /^bearer\s+\S/i.test(req.headers.get('authorization') ?? '');
    if (!hasBearer && !req.cookies.get(STAFF_SESSION_COOKIE)?.value) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/patient/:path*', '/staff/:path*', '/api/staff/:path*'],
};
