-- Initial schema for the anonymous pastebin.
-- Spec: docs/database.md (schema, RPC, security model).

create table public.pastes (
  id           text primary key,
  content      text,
  storage_path text,
  size_bytes   bigint not null check (size_bytes > 0),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  ip_hash      text not null,
  constraint pastes_payload_exclusive
    check ( (content is null) <> (storage_path is null) )
);

-- cleanup job scans on this
create index pastes_expires_at_idx on public.pastes (expires_at);

create table public.rate_limits (
  ip_hash      text primary key,
  window_start timestamptz not null,
  bytes_used   bigint not null default 0 check (bytes_used >= 0)
);

-- Atomic fixed-window byte-budget consumption. security definer so the
-- check-and-increment cannot race under concurrent requests.
create or replace function public.consume_rate_budget(
  p_ip_hash        text,
  p_request_bytes  bigint,
  p_budget         bigint,
  p_window         interval
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row          record;
  v_now          timestamptz := now();
  v_window_end   timestamptz;
begin
  -- uniform enforcement: reject requests larger than the whole budget even on
  -- a fresh window. Unreachable with correct config (bodies above
  -- PASTE_MAX_BYTES fail with 413 before this RPC runs); it guards against
  -- misconfiguration where the budget is lowered below the paste cap.
  if p_request_bytes > p_budget then
    return query select false,
      greatest(1, ceil(extract(epoch from p_window)))::int;
    return;
  end if;

  select * into v_row from public.rate_limits
   where ip_hash = p_ip_hash
   for update;

  -- new visitor, or window elapsed → fresh budget
  if v_row is null or v_row.window_start + p_window <= v_now then
    insert into public.rate_limits as rl (ip_hash, window_start, bytes_used)
    values (p_ip_hash, v_now, p_request_bytes)
    on conflict (ip_hash) do update
      set window_start = excluded.window_start,
          bytes_used   = excluded.bytes_used;
    return query select true, 0;
    return;
  end if;

  if v_row.bytes_used + p_request_bytes <= p_budget then
    update public.rate_limits
       set bytes_used = bytes_used + p_request_bytes
      where ip_hash = p_ip_hash;
    return query select true, 0;
    return;
  end if;

  v_window_end := v_row.window_start + p_window;
  return query select false,
    greatest(1, ceil(extract(epoch from (v_window_end - v_now))))::int;
end;
$$;

-- The RPC is only ever called by our server (service role). Postgres grants
-- EXECUTE on functions to PUBLIC by default, which would let anyone holding
-- the anon key tamper with rate counters via PostgREST.
revoke execute on function public.consume_rate_budget(text, bigint, bigint, interval) from public;
grant execute on function public.consume_rate_budget(text, bigint, bigint, interval) to service_role;

-- Row Level Security denies everything to non-service roles — no policies are
-- created, and anon/authenticated lose table privileges entirely.
alter table public.pastes      enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.pastes, public.rate_limits from anon, authenticated;

-- Private Storage bucket for large pastes; objects keyed `{id}`. No storage
-- policies are granted, so anon/authenticated have zero object access.
insert into storage.buckets (id, name, public)
values ('pastes', 'pastes', false)
on conflict (id) do nothing;
