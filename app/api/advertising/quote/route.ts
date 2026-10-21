import { NextResponse } from 'next/server';
import {
  ADVERTISING_DURATIONS,
  ADVERTISING_PACKAGES,
  type AdvertisingClientType,
  type AdvertisingDurationDays,
  getAdvertisingNetPrice,
} from '@/lib/advertising/catalog';

export const dynamic = 'force-dynamic';

const CLIENT_TYPES: AdvertisingClientType[] = ['salon_w_aplikacji', 'firma_zewnetrzna'];

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane wyceny.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Nieprawidłowe dane wyceny.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const packageId = input.packageId;
  const clientType = input.clientType;
  const durationDays = input.durationDays;

  if (typeof packageId !== 'string' || !ADVERTISING_PACKAGES.some((item) => item.id === packageId)) {
    return NextResponse.json({ error: 'Nieznany pakiet reklamowy.' }, { status: 400 });
  }

  if (typeof clientType !== 'string' || !CLIENT_TYPES.includes(clientType as AdvertisingClientType)) {
    return NextResponse.json({ error: 'Nieprawidłowy typ klienta.' }, { status: 400 });
  }

  if (typeof durationDays !== 'number' || !ADVERTISING_DURATIONS.includes(durationDays as AdvertisingDurationDays)) {
    return NextResponse.json({ error: 'Czas emisji musi wynosić 7, 30 lub 90 dni.' }, { status: 400 });
  }

  const selectedPackage = ADVERTISING_PACKAGES.find((item) => item.id === packageId);
  if (!selectedPackage) {
    return NextResponse.json({ error: 'Nieznany pakiet reklamowy.' }, { status: 400 });
  }

  const amountNetPln = getAdvertisingNetPrice(
    selectedPackage.id,
    clientType as AdvertisingClientType,
    durationDays as AdvertisingDurationDays,
  );

  return NextResponse.json({
    packageId: selectedPackage.id,
    packageName: selectedPackage.name,
    clientType,
    durationDays,
    currency: 'PLN',
    amountNetPln,
    amountNetMinor: Math.round(amountNetPln * 100),
    tax: 'calculated_by_configured_billing_system',
    payable: false,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
