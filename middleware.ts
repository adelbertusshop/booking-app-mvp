import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Przekierowuje niezalogowanych użytkowników z /admin do /admin/login
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminSession = request.cookies.get('admin_session')?.value;

    if (adminSession !== 'authenticated') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};