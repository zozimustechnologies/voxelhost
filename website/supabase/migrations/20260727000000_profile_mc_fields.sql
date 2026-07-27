-- Add Minecraft username and assigned container to profiles

alter table profiles
  add column if not exists minecraft_username text,
  add column if not exists container_id       text check (container_id in ('102', '103'));

-- Index for webhook lookups (sub id → profile → mc username + container)
create index if not exists profiles_minecraft_username_idx on profiles (minecraft_username);
