import { NextResponse } from 'next/server';
import {
  authenticateAdvertisingRequest,
} from '@/lib/advertising/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateAdvertisingRequest(request);
  if (!auth.ok) return auth.response;

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
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Nie udało się pobrać zamówień reklamowych.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const { count: exactOrderCount, error: countError } = await auth.context.supabase
    .from('ad_orders')
    .select('id', { count: 'exact', head: true })
    .eq('advertiser_user_id', auth.context.user.id);

  // Temporary Preview-only diagnostics. Never log tokens, keys, or customer data.
  const supabaseHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
    } catch {
      return 'invalid-supabase-url';
    }
  })();

  console.info('[LUMAR_AD_ORDERS_DIAGNOSTIC]', JSON.stringify({
    supabaseHost,
    authenticated: true,
    returnedRows: data?.length ?? 0,
    exactOrderCount,
    countQueryError: countError?.code ?? null,
    listQueryError: error?.code ?? null,
  }));

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
    campaign: order.campaign,
  }));

  return NextResponse.json({ orders }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
