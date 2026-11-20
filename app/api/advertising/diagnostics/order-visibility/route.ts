import { NextResponse } from 'next/server';
import { authenticateAdvertisingRequest } from '@/lib/advertising/auth';

export const dynamic = 'force-dynamic';

const TARGET_ORDER_ID = '6d490b72-e30a-4de2-a35b-12f792b7b9ff';

export async function GET(request: Request) {
  // This temporary diagnostic must never run on a production deployment.
  if (process.env.VERCEL_ENV !== 'preview') {
    return new NextResponse(null, { status: 404 });
  }

  const auth = await authenticateAdvertisingRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = auth.context.supabase;
  const userId = auth.context.user.id;

  // Run these reads sequentially to avoid confusing a transient replica/snapshot
  // difference with a filtering or projection problem.
  const countResult = await supabase
    .from('ad_orders')
    .select('id', { count: 'exact', head: true })
    .eq('advertiser_user_id', userId);

  const plainIdsResult = await supabase
    .from('ad_orders')
    .select('id, created_at, status')
    .eq('advertiser_user_id', userId)
    .limit(1000);

  const orderedIdsResult = await supabase
    .from('ad_orders')
    .select('id, created_at, status')
    .eq('advertiser_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const pageProjectionResult = await supabase
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
    `)
    .eq('advertiser_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const targetResult = await supabase
    .from('ad_orders')
    .select('id, created_at, advertiser_user_id, status')
    .eq('id', TARGET_ORDER_ID)
    .eq('advertiser_user_id', userId)
    .maybeSingle();

  const targetProjectionResult = await supabase
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
    `)
    .eq('id', TARGET_ORDER_ID)
    .eq('advertiser_user_id', userId)
    .maybeSingle();

  const errors = [
    countResult.error,
    plainIdsResult.error,
    orderedIdsResult.error,
    pageProjectionResult.error,
    targetResult.error,
    targetProjectionResult.error,
  ].filter(Boolean);

  if (errors.length) {
    return NextResponse.json(
      { error: 'Nie udało się wykonać diagnostyki.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const plainIds = plainIdsResult.data ?? [];
  const orderedIds = orderedIdsResult.data ?? [];
  const pageOrders = pageProjectionResult.data ?? [];

  return NextResponse.json(
    {
      diagnostic: 'advertising-order-visibility-v2',
      environment: 'preview',
      authenticated: true,
      visibleOrdersForAuthenticatedUser: countResult.count ?? 0,
      unorderedRowsReturned: plainIds.length,
      unorderedIds: plainIds.map((order) => order.id),
      orderedIds: orderedIds.map((order) => order.id),
      orderedCreatedAt: orderedIds.map((order) => ({
        id: order.id,
        createdAt: order.created_at,
        status: order.status,
      })),
      ordersReturnedByPageQuery: pageOrders.length,
      pageOrderIds: pageOrders.map((order) => order.id),
      targetOrderCreatedAt: targetResult.data?.created_at ?? null,
      targetOrderStatus: targetResult.data?.status ?? null,
      targetOrderExistsForAuthenticatedUser: Boolean(targetResult.data),
      targetOrderIncludedInUnorderedIds: plainIds.some((order) => order.id === TARGET_ORDER_ID),
      targetOrderIncludedInOrderedIds: orderedIds.some((order) => order.id === TARGET_ORDER_ID),
      targetOrderIncludedInPageQuery: pageOrders.some((order) => order.id === TARGET_ORDER_ID),
      targetOrderReturnedWithPageProjection: Boolean(targetProjectionResult.data),
      targetOrderProjectionHasCampaign: Boolean(targetProjectionResult.data?.campaign),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
