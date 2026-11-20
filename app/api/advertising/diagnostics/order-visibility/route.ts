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

  const [visibleOrders, targetInProject, targetForUser, ordersQuery, targetWithPageProjection] = await Promise.all([
    supabase
      .from('ad_orders')
      .select('id', { count: 'exact', head: true })
      .eq('advertiser_user_id', auth.context.user.id),
    supabase
      .from('ad_orders')
      .select('id')
      .eq('id', TARGET_ORDER_ID)
      .maybeSingle(),
    supabase
      .from('ad_orders')
      .select('id')
      .eq('id', TARGET_ORDER_ID)
      .eq('advertiser_user_id', auth.context.user.id)
      .maybeSingle(),
    supabase
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
      .eq('advertiser_user_id', auth.context.user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
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
      .eq('advertiser_user_id', auth.context.user.id)
      .maybeSingle(),
  ]);

  if (visibleOrders.error || targetInProject.error || targetForUser.error || ordersQuery.error || targetWithPageProjection.error) {
    return NextResponse.json(
      { error: 'Nie udało się wykonać diagnostyki.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      diagnostic: 'advertising-order-visibility',
      environment: 'preview',
      authenticated: true,
      visibleOrdersForAuthenticatedUser: visibleOrders.count ?? 0,
      ordersReturnedByPageQuery: ordersQuery.data?.length ?? 0,
      targetOrderExistsInProject: Boolean(targetInProject.data),
      targetOrderBelongsToAuthenticatedUser: Boolean(targetForUser.data),
      targetOrderIncludedInPageQuery: Boolean(ordersQuery.data?.some((order) => order.id === TARGET_ORDER_ID)),
      targetOrderReturnedWithPageProjection: Boolean(targetWithPageProjection.data),
      targetOrderProjectionHasCampaign: Boolean(targetWithPageProjection.data?.campaign),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
