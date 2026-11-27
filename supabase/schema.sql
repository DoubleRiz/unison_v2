-- =============================================================================
-- Unison — schéma complet (baseline) pour un nouveau projet Supabase
-- Reconstruit à partir du code de l'app et des données de l'ancien projet.
-- Intègre les migrations de supabase/migrations/ (text_notes, layout_document, mode, icon).
--
-- À exécuter UNE fois dans : Dashboard Supabase > SQL Editor > New query.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users : profils publics.
-- Pas de FK vers auth.users : les profils de l'ancienne base sont conservés
-- (« comptes hérités ») pour garder l'auteur des chansons/commentaires. Quand
-- quelqu'un se réinscrit, on relie son nouveau compte au profil hérité avec
-- public.relink_legacy_user() (voir en bas).
-- -----------------------------------------------------------------------------
create table public.users (
  id          uuid primary key,
  username    text not null unique,
  avatar_url  text,
  updated_at  timestamptz,
  is_admin    boolean not null default false
);

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.users(id) on update cascade on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid not null references public.users(id) on update cascade on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  role        text not null default 'member'  check (role in ('member', 'admin')),
  created_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

create table public.songs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on update cascade on delete cascade,
  title                 text not null,
  artist                text not null default '',
  bpm                   integer,
  original_key          text not null default 'C',
  content               text not null default '',
  notes                 text,
  youtube_url           text,
  audio_url             text,
  is_public             boolean not null default false,
  shared_with_group_id  uuid references public.groups(id) on delete set null,
  genres                text[] not null default '{}',
  tags                  text[] not null default '{}',
  forked_from           uuid references public.songs(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index songs_user_id_idx on public.songs(user_id);
create index songs_public_idx on public.songs(is_public) where is_public;
create index songs_group_idx on public.songs(shared_with_group_id);

create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on update cascade on delete cascade,
  song_id     uuid not null references public.songs(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, song_id)
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references public.songs(id) on delete cascade,
  user_id     uuid not null references public.users(id) on update cascade on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index comments_song_idx on public.comments(song_id);

create table public.setlists (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on update cascade on delete cascade,
  group_id         uuid references public.groups(id) on delete set null,
  title            text not null,
  icon             text,
  mode             text not null default 'list' check (mode in ('list', 'document')),
  text_notes       jsonb not null default '[]'::jsonb,
  layout_document  jsonb,
  created_at       timestamptz not null default now()
);
create index setlists_user_idx on public.setlists(user_id);
create index setlists_group_idx on public.setlists(group_id);

create table public.setlist_songs (
  id          uuid primary key default gen_random_uuid(),
  setlist_id  uuid not null references public.setlists(id) on delete cascade,
  song_id     uuid not null references public.songs(id) on delete cascade,
  position    integer not null default 0,
  transpose   integer not null default 0,
  created_at  timestamptz not null default now()
);
create index setlist_songs_setlist_idx on public.setlist_songs(setlist_id, position);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger songs_touch_updated_at before update on public.songs
  for each row execute function public.touch_updated_at();

-- Création automatique du profil à l'inscription (signUp envoie full_name).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));
begin
  -- Si le pseudo est déjà pris (ex. par un profil hérité), on suffixe.
  if exists (select 1 from public.users where username = wanted) then
    wanted := wanted || '_' || substr(new.id::text, 1, 4);
  end if;
  insert into public.users (id, username) values (new.id, wanted)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Fonctions d'aide pour les règles d'accès (security definer = pas de récursion RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false)
$$;

create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = gid and user_id = auth.uid() and status = 'accepted')
$$;

create or replace function public.is_group_admin(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = gid and user_id = auth.uid() and status = 'accepted' and role = 'admin')
      or exists (select 1 from public.groups where id = gid and created_by = auth.uid())
$$;

create or replace function public.has_group_membership(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- membre accepté OU invitation en attente (pour afficher le nom du groupe dans l'invitation)
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid())
$$;

create or replace function public.can_access_setlist(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.setlists s
    where s.id = sid
      and (s.user_id = auth.uid() or (s.group_id is not null and public.is_group_member(s.group_id)))
  )
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.users         enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.songs         enable row level security;
alter table public.favorites     enable row level security;
alter table public.comments      enable row level security;
alter table public.setlists      enable row level security;
alter table public.setlist_songs enable row level security;

-- users : lisibles par tous (pseudos, invitations par pseudo), modifiables par soi.
create policy users_select on public.users for select using (true);
create policy users_update on public.users for update
  using (id = auth.uid()) with check (id = auth.uid());
-- is_admin non modifiable par l'utilisateur lui-même
revoke update on public.users from anon, authenticated;
grant update (username, avatar_url, updated_at) on public.users to authenticated;

-- songs
create policy songs_select on public.songs for select using (
  is_public
  or user_id = auth.uid()
  or (shared_with_group_id is not null and public.is_group_member(shared_with_group_id))
  or public.is_admin()
);
create policy songs_insert on public.songs for insert to authenticated
  with check (user_id = auth.uid());
create policy songs_update on public.songs for update to authenticated using (
  user_id = auth.uid()
  or (shared_with_group_id is not null and public.is_group_member(shared_with_group_id))
  or public.is_admin()
);
create policy songs_delete on public.songs for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- favorites : privés
create policy favorites_all on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- comments
create policy comments_select on public.comments for select using (true);
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- groups
create policy groups_select on public.groups for select to authenticated
  using (created_by = auth.uid() or public.has_group_membership(id));
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = auth.uid());
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_admin(id));
create policy groups_delete on public.groups for delete to authenticated
  using (created_by = auth.uid());

-- group_members
create policy gm_select on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id) or public.is_group_admin(group_id));
create policy gm_insert on public.group_members for insert to authenticated
  with check (public.is_group_admin(group_id));
create policy gm_update on public.group_members for update to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));
create policy gm_delete on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));
-- seul le statut est modifiable (accepter une invitation), pas le rôle
revoke update on public.group_members from anon, authenticated;
grant update (status) on public.group_members to authenticated;

-- setlists
create policy setlists_select on public.setlists for select to authenticated
  using (user_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
create policy setlists_insert on public.setlists for insert to authenticated
  with check (user_id = auth.uid() and (group_id is null or public.is_group_member(group_id)));
create policy setlists_update on public.setlists for update to authenticated
  using (user_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
create policy setlists_delete on public.setlists for delete to authenticated
  using (user_id = auth.uid() or (group_id is not null and public.is_group_admin(group_id)));

-- setlist_songs : mêmes droits que la setlist parente
create policy setlist_songs_all on public.setlist_songs for all to authenticated
  using (public.can_access_setlist(setlist_id)) with check (public.can_access_setlist(setlist_id));

-- -----------------------------------------------------------------------------
-- Relier un nouveau compte à un profil hérité de l'ancienne base.
-- Usage (SQL Editor, après que la personne s'est réinscrite) :
--   select public.relink_legacy_user('<ancien id>', '<nouvel id auth>');
-- Le nouvel id se trouve dans Authentication > Users. Le contenu éventuellement
-- créé avec le nouveau compte est fusionné, puis le profil hérité prend le nouvel
-- id (cascade sur chansons, setlists, groupes, favoris, commentaires).
-- -----------------------------------------------------------------------------
create or replace function public.relink_legacy_user(legacy_id uuid, new_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from auth.users where id = new_id) then
    raise exception 'Aucun compte auth avec l''id %', new_id;
  end if;
  if exists (select 1 from auth.users where id = legacy_id) then
    raise exception '% est déjà un vrai compte, pas un profil hérité', legacy_id;
  end if;

  -- Rapatrier sur le profil hérité ce que le nouveau compte a déjà créé.
  update public.songs     set user_id    = legacy_id where user_id    = new_id;
  update public.comments  set user_id    = legacy_id where user_id    = new_id;
  update public.setlists  set user_id    = legacy_id where user_id    = new_id;
  update public.groups    set created_by = legacy_id where created_by = new_id;
  delete from public.favorites f where f.user_id = new_id
    and exists (select 1 from public.favorites g where g.user_id = legacy_id and g.song_id = f.song_id);
  update public.favorites set user_id = legacy_id where user_id = new_id;
  delete from public.group_members m where m.user_id = new_id
    and exists (select 1 from public.group_members n where n.user_id = legacy_id and n.group_id = m.group_id);
  update public.group_members set user_id = legacy_id where user_id = new_id;

  -- Supprimer le profil auto-créé, puis donner le nouvel id au profil hérité.
  delete from public.users where id = new_id;
  update public.users set id = new_id where id = legacy_id;
end $$;

revoke execute on function public.relink_legacy_user(uuid, uuid) from public, anon, authenticated;
