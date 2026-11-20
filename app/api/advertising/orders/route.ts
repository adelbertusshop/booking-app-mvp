import { NextResponse } from 'next/server';
import {
  authenticateAdvertisingRequest,
} from '@/lib/advertising/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateAdvertisingRequest(request);
  if (!auth.ok) return auth.response;

  // Fetch orders without an embedded relation. Ordering an embedded campaign
  // projection caused PostgREST to omit a valid newest order in Preview.
  const { data, error } = await auth.context.supabase
    .from('ad_orders')
    .select(`
      id,
      campaign_id,
      package_id,
      client_type,
      duration_days,
      amount_net_minor,
      amount_total_minor,
      currency,
      status,
      stripe_checkout_session_id,
      paid_at,
      created_at
    `)
    .eq('advertiser_user_id', auth.context.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Nie udało się pobrać zamówień reklamowych.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const campaignIds = (data ?? [])
    .map((order) => order.campaign_id)
    .filter((id): id is string => Boolean(id));

  let campaigns: Array<{
    id: string;
    title: string | null;
    placement: string | null;
    placement_slot: string | null;
    status: string | null;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string | null;
  }> = [];

  if (campaignIds.length > 0) {
    const { data: campaignData, error: campaignError } = await auth.context.supabase
      .from('ad_campaigns')
      .select('id, title, placement, placement_slot, status, starts_at, ends_at, created_at')
      .in('id', campaignIds);

    if (campaignError) {
      return NextResponse.json({ error: 'Nie udało się pobrać kampanii reklamowych.' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    campaigns = campaignData ?? [];
  }

  const campaignsById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  const orders = (data ?? []).map((order) => ({
    id: order.id,
    campaignId: order.campaign_id,
    packageId: order.package_id,
    clientType: order.client_type,
    durationDays: order.duration_days,
    amountMinor: order.amount_total_minor ?? order.amount_net_minor,
    currency: order.currency,
    paymentStatus: order.status,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    campaign: order.campaign_id ? campaignsById.get(order.campaign_id) ?? null : null,
  }));

  return NextResponse.json({ orders }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
