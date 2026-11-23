import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'lumar-advertising';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_SLOTS = {
  home_screen_banner: { placement: 'lumar_pages', placementSlot: 'home_screen_banner', limit: 1 },
  salon_listing: { placement: 'salon_catalog', placementSlot: 'salon_listing', limit: 12 },
  featured_profile: { placement: 'salon_catalog', placementSlot: 'featured_profile', limit: 1 },
  in_app_banner: { placement: 'lumar_pages', placementSlot: 'in_app_banner', limit: 3 },
  sponsored_carousel: { placement: 'lumar_pages', placementSlot: 'sponsored_carousel', limit: 8 },
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
    return NextResponse.json({ ads: [] }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const slot = PUBLIC_SLOTS[requestedSlot as PublicSlot];
  const salonId = request.nextUrl.searchParams.get('salonId');
  if (requestedSlot === 'featured_profile' && (!salonId || !UUID_RE.test(salonId))) {
    return NextResponse.json({ ads: [] }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ads: [] }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const now = new Date().toISOString();

    // Expired campaigns are never served; update their status opportunistically
    // so the advertiser's order history converges to "completed" without a live cron.
    await supabase
      .from('ad_campaigns')
      .update({ status: 'completed', updated_at: now })
      .eq('status', 'active')
      .lte('ends_at', now);

    let query = supabase
      .from('ad_campaigns')
      .select('id, salon_id, title, body, destination_url, image_path, starts_at, ends_at')
      .eq('placement', slot.placement)
      .eq('placement_slot', slot.placementSlot)
      .eq('status', 'active')
      .lte('starts_at', now)
      .gt('ends_at', now)
      .order('starts_at', { ascending: true })
      .limit(slot.limit);

    if (requestedSlot === 'featured_profile') query = query.eq('salon_id', salonId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ads: [] }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const ads = (data ?? []).flatMap((campaign) => {
      const destinationUrl = safeHttpsUrl(campaign.destination_url);
      if (!destinationUrl || typeof campaign.title !== 'string') return [];
      const imageUrl = typeof campaign.image_path === 'string'
        ? supabase.storage.from(BUCKET).getPublicUrl(campaign.image_path).data.publicUrl
        : null;
      return [{
        id: campaign.id,
        salonId: campaign.salon_id,
        title: campaign.title,
        body: typeof campaign.body === 'string' ? campaign.body : null,
        destinationUrl,
        imageUrl,
      }];
    });

    return NextResponse.json({ ads }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ ads: [] }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
