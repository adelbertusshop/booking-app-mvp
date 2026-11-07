import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET() {
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
      .eq('placement', 'salon_catalog')
      .eq('placement_slot', 'salon_listing')
      .eq('status', 'active')
      .lte('starts_at', now)
      .gt('ends_at', now)
      .order('starts_at', { ascending: true })
      .limit(6);

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
