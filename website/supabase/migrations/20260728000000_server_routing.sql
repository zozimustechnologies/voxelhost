-- ── assign_server() ─────────────────────────────────────────────────────────
-- Returns the container_id from server_configs with the fewest active subscriptions.
-- Falls back to '102' if no servers are configured.
create or replace function assign_server()
returns text language sql security definer as $$
  select sc.container_id
  from server_configs sc
  left join (
    select p.container_id, count(*) as active_count
    from profiles p
    join subscriptions s on s.user_id = p.id
    where s.status = 'active'
    group by p.container_id
  ) counts on counts.container_id = sc.container_id
  order by coalesce(counts.active_count, 0) asc
  limit 1;
$$;

-- ── expire_subscriptions() ───────────────────────────────────────────────────
-- Marks expired subscriptions as 'expired' and queues whitelist remove jobs.
create or replace function expire_subscriptions()
returns void language plpgsql security definer as $$
declare
  rec record;
begin
  for rec in
    select s.id, s.user_id, p.minecraft_username, p.container_id
    from subscriptions s
    join profiles p on p.id = s.user_id
    where s.status = 'active'
      and s.current_period_end < now()
  loop
    -- Mark expired
    update subscriptions set status = 'expired' where id = rec.id;

    -- Queue whitelist remove job if player info is set
    if rec.minecraft_username is not null and rec.container_id is not null then
      insert into server_jobs (type, payload)
      values ('mc_allowlist_remove', jsonb_build_object(
        'username',     rec.minecraft_username,
        'container_id', rec.container_id
      ));
    end if;
  end loop;
end;
$$;

-- ── pg_cron: run every 15 minutes ────────────────────────────────────────────
select cron.schedule(
  'expire-subscriptions',
  '*/15 * * * *',
  $$ select expire_subscriptions(); $$
);
