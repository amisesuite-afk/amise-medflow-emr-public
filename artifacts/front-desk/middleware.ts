import { NextRequest, NextResponse } from 'next/server';

const PATIENT_PUBLIC = ['/patient/login', '/patient/auth'];
const STAFF_PUBLIC   = ['/staff/login'];

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
  if (pathname.startsWith('/staff')) {
    if (STAFF_PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
    if (!hasSessionCookie(req, 'amise-staff-session')) {
      const url = req.nextUrl.clone();
      url.pathname = '/staff/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Staff API routes ─────────────────────────────────────────────────────────
  // /api/staff/* routes use getServiceClient() (no per-request auth).
  // Gate them at the middleware layer so they can't be reached without a
  // valid staff session cookie — same check as the /staff/* page routes.
  if (pathname.startsWith('/api/staff/')) {
    if (!hasSessionCookie(req, 'amise-staff-session')) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/patient/:path*', '/staff/:path*', '/api/staff/:path*'],
};
