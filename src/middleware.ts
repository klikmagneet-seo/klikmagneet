import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = ['/login', '/api/auth', '/review', '/api/review'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get('km_session');
  const secret = process.env.AUTH_SECRET;

  if (!secret || !session?.value || session.value !== secret) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
