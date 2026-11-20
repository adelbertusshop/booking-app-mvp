import { NextResponse } from 'next/server';
import { authenticateAdvertisingRequest } from '@/lib/advertising/auth';

export const dynamic = 'force-dynamic';

const TARGET_ORDER_ID = '6d490b72-e30a-4de2-a35b-12f792b7b9ff';

const PAGE_SELECT = `
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
  created_at,
  campaign:ad_campaigns (
    id,
    title,
    placement,
    placement_slot,
    status,
    starts_at,
    ends_at,
    created_at
  )
`;

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return new NextResponse(null, { status: 404 });
  }

  const auth = await authenticateAdvertisingRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = auth.context.supabase;
  const userId = auth.context.user.id;

  const countResult = await supabase
    .from('ad_orders')
    .select('id', { count: 'exact', head: true })
    .eq('advertiser_user_id', userId);

  const plainResult = await supabase
    .from('ad_orders')
    .select('id, created_at, status, campaign_id')
    .eq('advertiser_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const relationNoOrderResult = await supabase
    .from('ad_orders')
    .select(PAGE_SELECT)
    .eq('advertiser_user_id', userId)
    .limit(50);

  const relationOrderedResult = await supabase
    .from('ad_orders')
    .select(PAGE_SELECT)
    .eq('advertiser_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const targetResult = await supabase
    .from('ad_orders')
    .select(PAGE_SELECT)
    .eq('id', TARGET_ORDER_ID)
    .eq('advertiser_user_id', userId)
    .maybeSingle();

  const results = [countResult, plainResult, relationNoOrderResult, relationOrderedResult, targetResult];
  if (results.some((result) => result.error)) {
    return NextResponse.json(
      { error: 'Nie udało się wykonać diagnostyki.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const plain = plainResult.data ?? [];
  const relationNoOrder = relationNoOrderResult.data ?? [];
  const relationOrdered = relationOrderedResult.data ?? [];
  const target = targetResult.data;

  return NextResponse.json({
    diagnostic: 'advertising-order-visibility-v3',
    environment: 'preview',
    authenticated: true,
    countExactHead: countResult.count ?? null,
    plainRows: plain.length,
    plainIds: plain.map((row) => row.id),
    relationRowsWithoutOrder: relationNoOrder.length,
    relationIdsWithoutOrder: relationNoOrder.map((row) => row.id),
    relationRowsWithOrder: relationOrdered.length,
    relationIdsWithOrder: relationOrdered.map((row) => row.id),
    relationRowsWithOrderAndCampaign: relationOrdered.map((row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      embeddedCampaignId: Array.isArray(row.campaign) ? row.campaign[0]?.id ?? null : null,
      embeddedCampaignPresent: Array.isArray(row.campaign) ? row.campaign.length > 0 : Boolean(row.campaign),
    })),
    targetOrder: target ? {
      id: target.id,
      campaignId: target.campaign_id,
      embeddedCampaignId: Array.isArray(target.campaign) ? target.campaign[0]?.id ?? null : null,
      embeddedCampaignPresent: Array.isArray(target.campaign) ? target.campaign.length > 0 : Boolean(target.campaign),
      createdAt: target.created_at,
      status: target.status,
    } : null,
    targetInPlain: plain.some((row) => row.id === TARGET_ORDER_ID),
    targetInRelationWithoutOrder: relationNoOrder.some((row) => row.id === TARGET_ORDER_ID),
    targetInRelationWithOrder: relationOrdered.some((row) => row.id === TARGET_ORDER_ID),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
