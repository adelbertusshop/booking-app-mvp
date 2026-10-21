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

async function readBoundedBody(request: Request): Promise<
  | { ok: true; text: string }
  | { ok: false; response: ReturnType<typeof errorResponse> }
> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      return { ok: false, response: errorResponse('Nieprawidłowy rozmiar żądania.', 400) };
    }
    if (parsedLength > MAX_REQUEST_BYTES) {
      return { ok: false, response: errorResponse('Żądanie jest zbyt duże.', 413) };
    }
  }

  if (!request.body) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, response: errorResponse('Żądanie jest zbyt duże.', 413) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: errorResponse('Nie udało się odczytać danych wyceny.', 400) };
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes) };
  } catch {
    return { ok: false, response: errorResponse('Dane wyceny muszą być poprawnym tekstem UTF-8.', 400) };
  }
}

export async function POST(request: Request) {
  const boundedBody = await readBoundedBody(request);
  if (!boundedBody.ok) return boundedBody.response;

  let body: unknown;
  try {
    body = JSON.parse(boundedBody.text);
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
