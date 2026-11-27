-- Aggregate advertising performance metrics without exposing raw event rows.
begin;

create or replace function public.lumar_advertising_event_stats(p_campaign_ids uuid[])
returns table (
  campaign_id uuid,
  impressions bigint,
  clicks bigint
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    e.campaign_id,
    count(*) filter (where e.event_type = 'impression')::bigint as impressions,
    count(*) filter (where e.event_type = 'click')::bigint as clicks
  from public.ad_events e
  where e.campaign_id = any(p_campaign_ids)
  group by e.campaign_id;
$$;

revoke all on function public.lumar_advertising_event_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.lumar_advertising_event_stats(uuid[]) to service_role;

commit;
