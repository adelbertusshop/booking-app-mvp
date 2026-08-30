import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.get('admin_authenticated')?.value === 'true';
  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  // Jeśli nie jest zalogowany i próbuje wejść do /admin, przekieruj na login
  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // Jeśli jest zalogowany i wchodzi na /admin/login, przekieruj do panelu
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};