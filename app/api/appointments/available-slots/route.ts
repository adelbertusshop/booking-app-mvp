import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ 
    slots: ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'] 
  }, { status: 200 });
}