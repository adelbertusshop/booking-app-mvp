-- Align the isolated Preview advertising security boundary with production.
-- No data is modified. Client roles lose direct table/sequence access;
-- all advertising data access remains behind authenticated server routes.

begin;

revoke all on table
  public.ad_campaigns,
  public.ad_orders,
  public.ad_order_idempotency,
  public.ad_events,
  public.ad_stripe_webhook_events
from public, anon, authenticated;

grant all on table
  public.ad_campaigns,
  public.ad_orders,
  public.ad_order_idempotency,
  public.ad_events,
  public.ad_stripe_webhook_events
to service_role;

revoke all on sequence public.ad_events_id_seq
from public, anon, authenticated;

grant usage, select on sequence public.ad_events_id_seq
to service_role;

alter function public.lumar_create_advertising_order(
  uuid, text, text, text, uuid, text, text, text, text, text, text,
  integer, bigint, text, text
) set search_path = pg_catalog;

revoke all on function public.lumar_create_advertising_order(
  uuid, text, text, text, uuid, text, text, text, text, text, text,
  integer, bigint, text, text
) from public, anon, authenticated;

grant execute on function public.lumar_create_advertising_order(
  uuid, text, text, text, uuid, text, text, text, text, text, text,
  integer, bigint, text, text
) to service_role;

commit;
