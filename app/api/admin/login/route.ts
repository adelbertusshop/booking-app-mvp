import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    if (password === process.env.ADMIN_PASSWORD) {
      const response = NextResponse.json({ success: true });
      response.cookies.set('admin_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    }
    return NextResponse.json({ error: 'Nieprawidłowe hasło' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}