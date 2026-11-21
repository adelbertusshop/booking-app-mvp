import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_SLOTS = {
  home_screen_banner: {
    placement: 'lumar_pages',
    placementSlot: 'home_screen_banner',
    limit: 1,
  },
  salon_listing: {
    placement: 'salon_catalog',
    placementSlot: 'salon_listing',
    limit: 6,
  },
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

export async function GET(request: NextRequest) {
  const requestedSlot = request.nextUrl.searchParams.get('slot') ?? 'salon_listing';
  if (!Object.prototype.hasOwnProperty.call(PUBLIC_SLOTS, requestedSlot)) {
    return NextResponse.json(
      { ads: [] },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const slot = PUBLIC_SLOTS[requestedSlot as PublicSlot];
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
    const { data, error } = await supabase
      .from('ad_campaigns')
      .select('id, title, body, destination_url, starts_at, ends_at')
      .eq('placement', slot.placement)
      .eq('placement_slot', slot.placementSlot)
      .eq('status', 'active')
      .lte('starts_at', now)
      .gt('ends_at', now)
      .order('starts_at', { ascending: true })
      .limit(slot.limit);

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
