import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_SLOTS = {
  salon_listing: 'salon_catalog',
  featured_profile: 'salon_catalog',
  home_screen_banner: 'lumar_pages',
} as const;

type PublicSlot = keyof typeof PUBLIC_SLOTS;

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedSlot = url.searchParams.get('slot') ?? 'salon_listing';
  if (!(requestedSlot in PUBLIC_SLOTS)) {
    return NextResponse.json(
      { ads: [] },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const slot = requestedSlot as PublicSlot;
  const placement = PUBLIC_SLOTS[slot];
  const salonId = url.searchParams.get('salonId');
  if (slot === 'featured_profile' && (!salonId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(salonId))) {
    return NextResponse.json(
      { ads: [] },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ads: [] },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const now = new Date().toISOString();
    let query = supabase
      .from('ad_campaigns')
      .select('id, title, body, destination_url, starts_at, ends_at')
      .eq('placement', placement)
      .eq('placement_slot', slot)
      .eq('status', 'active')
      .lte('starts_at', now)
      .gt('ends_at', now);

    if (slot === 'featured_profile') query = query.eq('salon_id', salonId!);

    const { data, error } = await query
      .order('starts_at', { ascending: true })
      .limit(slot === 'salon_listing' ? 6 : 3);

    if (error) {
      return NextResponse.json(
        { ads: [] },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const ads = (data ?? []).flatMap((campaign) => {
      const destinationUrl = safeHttpsUrl(campaign.destination_url);
      if (!destinationUrl || typeof campaign.title !== 'string') return [];
      return [{
        id: campaign.id,
        title: campaign.title,
        body: typeof campaign.body === 'string' ? campaign.body : null,
        destinationUrl,
      }];
    });

    return NextResponse.json(
      { ads },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { ads: [] },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
