import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authenticateAdvertisingRequest } from '@/lib/advertising/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'lumar-advertising';
const MAX_BYTES = 5 * 1024 * 1024;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function detectImage(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.length >= 12 &&
      String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF' &&
      String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  return null;
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === 'production') {
    return fail('Przesyłanie reklam jest wyłączone w środowisku produkcyjnym.', 503);
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES + 32 * 1024) return fail('Grafika może mieć maksymalnie 5 MB.', 413);

  const auth = await authenticateAdvertisingRequest(request);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Nie udało się odczytać przesłanego pliku.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return fail('Wybierz plik graficzny.', 400);
  if (file.size < 1 || file.size > MAX_BYTES) return fail('Grafika może mieć maksymalnie 5 MB.', 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected || file.type !== detected.mime) {
    return fail('Dozwolone są prawidłowe pliki JPG, PNG lub WEBP.', 415);
  }

  const path = `${auth.context.user.id}/${randomUUID()}.${detected.extension}`;
  const { error } = await auth.context.supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: detected.mime,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) return fail('Nie udało się zapisać grafiki. Spróbuj ponownie.', 503);

  return NextResponse.json({ imagePath: path }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  });
}
