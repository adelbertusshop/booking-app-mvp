import 'server-only';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export type AdvertisingAuthContext = {
  supabase: SupabaseClient;
  user: User;
};

export type AdvertisingAuthResult =
  | { ok: true; context: AdvertisingAuthContext }
  | { ok: false; response: NextResponse };

/**
 * Server-only authorization for advertising endpoints.
 *
 * Requires a bearer access token issued by Supabase Auth. The user is verified
 * against Supabase Auth; request-body user IDs and client-side role flags are
 * never trusted. Fails closed if server configuration is incomplete.
 */
export async function authenticateAdvertisingRequest(
  request: Request,
): Promise<AdvertisingAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Usługa reklamowa jest chwilowo niedostępna.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      ),
    };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match || match[1].length > 4096) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Wymagane jest zalogowanie.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sesja jest nieprawidłowa lub wygasła.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
    };
  }

  return { ok: true, context: { supabase, user: data.user } };
}

/**
 * Platform moderation is separate from salon-owner access.
 * An empty or missing allowlist intentionally grants no administrator access.
 * Configure LUMAR_PLATFORM_ADMIN_USER_IDS as a comma-separated list of
 * verified Supabase Auth UUIDs in the appropriate server environment.
 */
export function isAdvertisingPlatformAdmin(userId: string): boolean {
  const configuredIds = (process.env.LUMAR_PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  return configuredIds.includes(userId.toLowerCase());
}

export function requireAdvertisingPlatformAdmin(
  user: User,
): NextResponse | null {
  if (isAdvertisingPlatformAdmin(user.id)) return null;

  return NextResponse.json(
    { error: 'Brak uprawnień administratora platformy.' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Verify salon ownership server-side before any campaign/order write.
 * The caller must treat database errors as a failure and must not continue.
 */
export async function verifyAdvertisingSalonOwnership(
  supabase: SupabaseClient,
  userId: string,
  salonId: string,
): Promise<{ owned: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from('salons')
    .select('id')
    .eq('id', salonId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { owned: false, error: 'Nie udało się zweryfikować właściciela salonu.' };
  }

  return { owned: Boolean(data), error: null };
}
