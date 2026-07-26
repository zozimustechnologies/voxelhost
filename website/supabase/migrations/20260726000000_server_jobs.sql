-- Server jobs queue table
-- Used by the Proxmox agent to pick up and execute management tasks.

create type server_job_type as enum (
  'mc_allowlist_add',
  'mc_allowlist_remove',
  'proxmox_backup'
);

create type server_job_status as enum (
  'pending',
  'running',
  'done',
  'failed'
);

create table server_jobs (
  id          uuid                primary key default gen_random_uuid(),
  type        server_job_type     not null,
  payload     jsonb               not null default '{}',
  status      server_job_status   not null default 'pending',
  result      text,
  created_at  timestamptz         not null default now(),
  updated_at  timestamptz         not null default now()
);

-- Index for the agent's polling query
create index server_jobs_pending_idx on server_jobs (status, created_at)
  where status = 'pending';

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger server_jobs_updated_at
  before update on server_jobs
  for each row execute procedure set_updated_at();

-- Only the service role can read/write jobs (agent uses service role key)
alter table server_jobs enable row level security;
