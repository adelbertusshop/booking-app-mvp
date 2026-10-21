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
const MAX_REQUEST_BYTES = 4 * 1024;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      return errorResponse('Nieprawidłowy rozmiar żądania.', 400);
    }
    if (parsedLength > MAX_REQUEST_BYTES) {
      return errorResponse('Żądanie jest zbyt duże.', 413);
    }
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse('Nie udało się odczytać danych wyceny.', 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return errorResponse('Żądanie jest zbyt duże.', 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse('Nieprawidłowe dane wyceny.', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorResponse('Nieprawidłowe dane wyceny.', 400);
  }

  const input = body as Record<string, unknown>;
  const packageId = input.packageId;
  const clientType = input.clientType;
  const durationDays = input.durationDays;

  if (typeof packageId !== 'string' || !ADVERTISING_PACKAGES.some((item) => item.id === packageId)) {
    return errorResponse('Nieznany pakiet reklamowy.', 400);
  }

  if (typeof clientType !== 'string' || !CLIENT_TYPES.includes(clientType as AdvertisingClientType)) {
    return errorResponse('Nieprawidłowy typ klienta.', 400);
  }

  if (typeof durationDays !== 'number' || !ADVERTISING_DURATIONS.includes(durationDays as AdvertisingDurationDays)) {
    return errorResponse('Czas emisji musi wynosić 7, 30 lub 90 dni.', 400);
  }

  const selectedPackage = ADVERTISING_PACKAGES.find((item) => item.id === packageId);
  if (!selectedPackage) {
    return errorResponse('Nieznany pakiet reklamowy.', 400);
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
    amountNetMinor: amountNetPln * 100,
    taxStatus: 'not_configured',
    payable: false,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
