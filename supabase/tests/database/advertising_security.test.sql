begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- 1-5: Required advertising tables exist.
select has_table('public', 'ad_campaigns', 'campaign table exists');
select has_table('public', 'ad_orders', 'orders table exists');
select has_table('public', 'ad_events', 'events table exists');
select has_table('public', 'ad_stripe_webhook_events', 'webhook inbox table exists');
select has_table('public', 'ad_order_idempotency', 'idempotency table exists');

-- 6-10: RLS is enabled on every advertising table.
select ok((select relrowsecurity from pg_class where oid = 'public.ad_campaigns'::regclass), 'RLS enabled on campaigns');
select ok((select relrowsecurity from pg_class where oid = 'public.ad_orders'::regclass), 'RLS enabled on orders');
select ok((select relrowsecurity from pg_class where oid = 'public.ad_events'::regclass), 'RLS enabled on events');
select ok((select relrowsecurity from pg_class where oid = 'public.ad_stripe_webhook_events'::regclass), 'RLS enabled on webhook inbox');
select ok((select relrowsecurity from pg_class where oid = 'public.ad_order_idempotency'::regclass), 'RLS enabled on idempotency');

-- 11: No client role or PUBLIC has direct table privileges.
select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    where n.nspname = 'public'
      and c.relname = any (array[
        'ad_campaigns', 'ad_orders', 'ad_events',
        'ad_stripe_webhook_events', 'ad_order_idempotency'
      ])
      and a.grantee in (
        0,
        (select oid from pg_roles where rolname = 'anon'),
        (select oid from pg_roles where rolname = 'authenticated')
      )
  ),
  'No direct table grants to PUBLIC, anon or authenticated'
);

-- 12: Server role can access the tables.
select ok(
  has_table_privilege('service_role', 'public.ad_campaigns', 'SELECT')
  and has_table_privilege('service_role', 'public.ad_orders', 'SELECT')
  and has_table_privilege('service_role', 'public.ad_events', 'SELECT')
  and has_table_privilege('service_role', 'public.ad_stripe_webhook_events', 'SELECT')
  and has_table_privilege('service_role', 'public.ad_order_idempotency', 'SELECT'),
  'service_role has required table access'
);

-- 13-14: Both server-side RPCs exist.
select ok(
  to_regprocedure('public.lumar_create_advertising_order(uuid,text,text,text,uuid,text,text,text,text,text,text,integer,bigint,text,text)') is not null,
  'order creation RPC exists'
);
select ok(
  to_regprocedure('public.lumar_apply_advertising_payment_success(text,uuid,uuid,uuid,text,text,bigint,text,boolean,boolean)') is not null,
  'payment success RPC exists'
);

-- 15-16: Privileged functions use SECURITY DEFINER with a locked search_path.
select ok((
  select prosecdef and proconfig @> array['search_path=pg_catalog']
  from pg_proc
  where oid = to_regprocedure('public.lumar_create_advertising_order(uuid,text,text,text,uuid,text,text,text,text,text,text,integer,bigint,text,text)')
), 'order RPC is SECURITY DEFINER with locked search_path');
select ok((
  select prosecdef and proconfig @> array['search_path=pg_catalog']
  from pg_proc
  where oid = to_regprocedure('public.lumar_apply_advertising_payment_success(text,uuid,uuid,uuid,text,text,bigint,text,boolean,boolean)')
), 'payment RPC is SECURITY DEFINER with locked search_path');

-- 17-18: RPC execution is restricted to service_role.
select ok(
  not has_function_privilege('anon', to_regprocedure('public.lumar_create_advertising_order(uuid,text,text,text,uuid,text,text,text,text,text,text,integer,bigint,text,text)'), 'EXECUTE')
  and not has_function_privilege('authenticated', to_regprocedure('public.lumar_create_advertising_order(uuid,text,text,text,uuid,text,text,text,text,text,text,integer,bigint,text,text)'), 'EXECUTE')
  and has_function_privilege('service_role', to_regprocedure('public.lumar_create_advertising_order(uuid,text,text,text,uuid,text,text,text,text,text,text,integer,bigint,text,text)'), 'EXECUTE'),
  'order RPC execute privilege is service_role only'
);
select ok(
  not has_function_privilege('anon', to_regprocedure('public.lumar_apply_advertising_payment_success(text,uuid,uuid,uuid,text,text,bigint,text,boolean,boolean)'), 'EXECUTE')
  and not has_function_privilege('authenticated', to_regprocedure('public.lumar_apply_advertising_payment_success(text,uuid,uuid,uuid,text,text,bigint,text,boolean,boolean)'), 'EXECUTE')
  and has_function_privilege('service_role', to_regprocedure('public.lumar_apply_advertising_payment_success(text,uuid,uuid,uuid,text,text,bigint,text,boolean,boolean)'), 'EXECUTE'),
  'payment RPC execute privilege is service_role only'
);

-- 19: The advertising tables intentionally have no direct client policies.
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'ad_campaigns', 'ad_orders', 'ad_events',
        'ad_stripe_webhook_events', 'ad_order_idempotency'
      ])
  ),
  'advertising tables have no direct client RLS policies'
);

-- 20: The identity sequence is not exposed to client roles.
select ok(
  not has_sequence_privilege('anon', 'public.ad_events_id_seq', 'USAGE')
  and not has_sequence_privilege('authenticated', 'public.ad_events_id_seq', 'USAGE')
  and has_sequence_privilege('service_role', 'public.ad_events_id_seq', 'USAGE'),
  'event identity sequence is service_role only'
);

select * from finish();
rollback;
