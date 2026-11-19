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

  const [visibleOrders, targetInProject, targetForUser] = await Promise.all([
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
  ]);

  if (visibleOrders.error || targetInProject.error || targetForUser.error) {
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
      targetOrderExistsInProject: Boolean(targetInProject.data),
      targetOrderBelongsToAuthenticatedUser: Boolean(targetForUser.data),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
