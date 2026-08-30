import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (password === adminPassword) {
      const cookieStore = await cookies();
      cookieStore.set('admin_authenticated', 'true', {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24, // 24 godziny
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Nieprawidłowe hasło' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Błąd serwera' },
      { status: 500 }
    );
  }
}