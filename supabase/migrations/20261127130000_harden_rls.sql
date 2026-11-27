-- =============================================================================
-- Durcissement des règles d'accès (audit sécurité du 27/11/2026)
--
-- 1. Chansons : un membre de groupe peut modifier une chanson partagée, mais pas
--    se l'approprier, changer sa visibilité ni la déplacer vers un autre groupe.
-- 2. Setlists : un membre de groupe ne peut plus s'approprier une setlist ni la
--    retirer du groupe ; on ne peut rattacher une setlist qu'à un de ses groupes.
-- 3. Commentaires : lisibles seulement si on peut voir la chanson.
-- 4. Partage : on ne peut partager une chanson qu'avec un groupe dont on est membre.
-- 5. Profils : la colonne is_admin n'est plus lisible (utiliser public.is_admin()).
-- 6. Invitations : un admin ne peut créer que des invitations en attente, et seule
--    la personne invitée peut l'accepter.
--
-- Les vérifications des triggers sont ignorées quand auth.uid() est nul (SQL
-- Editor, service role, public.relink_legacy_user) : les rôles anon/authenticated
-- passent toujours par un JWT, donc auth.uid() n'est jamais nul pour eux en écriture.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 + 4. Chansons
-- -----------------------------------------------------------------------------
create or replace function public.guard_song_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Impossible de changer le propriétaire d''une chanson.'
      using errcode = '42501';
  end if;

  if (new.is_public is distinct from old.is_public
      or new.shared_with_group_id is distinct from old.shared_with_group_id)
     and old.user_id <> auth.uid() then
    raise exception 'Seul le propriétaire peut changer la visibilité ou le groupe d''une chanson.'
      using errcode = '42501';
  end if;

  if new.shared_with_group_id is distinct from old.shared_with_group_id
     and new.shared_with_group_id is not null
     and not public.is_group_member(new.shared_with_group_id) then
    raise exception 'Vous n''êtes pas membre de ce groupe.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists songs_guard_update on public.songs;
create trigger songs_guard_update before update on public.songs
  for each row execute function public.guard_song_update();

drop policy if exists songs_insert on public.songs;
create policy songs_insert on public.songs for insert to authenticated
  with check (
    user_id = auth.uid()
    and (shared_with_group_id is null or public.is_group_member(shared_with_group_id))
  );

-- -----------------------------------------------------------------------------
-- 2. Setlists
-- -----------------------------------------------------------------------------
create or replace function public.guard_setlist_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Impossible de changer le propriétaire d''une setlist.'
      using errcode = '42501';
  end if;

  if new.group_id is distinct from old.group_id then
    if old.user_id <> auth.uid() then
      raise exception 'Seul le propriétaire peut changer le groupe d''une setlist.'
        using errcode = '42501';
    end if;
    if new.group_id is not null and not public.is_group_member(new.group_id) then
      raise exception 'Vous n''êtes pas membre de ce groupe.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists setlists_guard_update on public.setlists;
create trigger setlists_guard_update before update on public.setlists
  for each row execute function public.guard_setlist_update();

-- -----------------------------------------------------------------------------
-- 3. Commentaires : visibles si la chanson l'est (la sous-requête applique la
--    RLS de songs pour l'utilisateur courant).
-- -----------------------------------------------------------------------------
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select
  using (exists (select 1 from public.songs s where s.id = song_id));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.songs s where s.id = song_id)
  );

-- -----------------------------------------------------------------------------
-- 5. Profils : is_admin n'est plus lisible directement.
-- -----------------------------------------------------------------------------
revoke select on public.users from anon, authenticated;
grant select (id, username, avatar_url, updated_at) on public.users to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Invitations
-- -----------------------------------------------------------------------------
drop policy if exists gm_insert on public.group_members;
create policy gm_insert on public.group_members for insert to authenticated
  with check (
    -- un admin invite : invitation en attente, rôle membre
    (public.is_group_admin(group_id) and status = 'pending' and role = 'member')
    -- le créateur s'ajoute lui-même comme admin à la création du groupe
    or (user_id = auth.uid()
        and exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()))
  );

drop policy if exists gm_update on public.group_members;
create policy gm_update on public.group_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
