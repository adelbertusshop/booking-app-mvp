import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Autoryzacja panelu /admin odbywa się przez Supabase Auth
// bezpośrednio w app/admin/page.tsx — middleware nie jest potrzebny.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
