begin;

alter table public.profiles
  add column if not exists menus_autorises text[];

comment on column public.profiles.menus_autorises is
  'Liste blanche des onglets visibles. NULL = aucune restriction (comportement par defaut, decide par le role et les modules actifs). Une liste ne peut que RESTREINDRE : elle ne donne jamais acces a un module que l''entreprise n''a pas active.';

create or replace function public.definir_menus_autorises(
  p_profile_id uuid,
  p_menus      text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appelant   record;
  v_cible      record;
begin
  select id, role, entreprise_id, is_super_admin
    into v_appelant
  from public.profiles
  where id = auth.uid();

  if v_appelant.id is null then
    raise exception 'AUTH_REQUISE' using detail = 'Aucun profil pour cette session.';
  end if;

  select id, entreprise_id, is_super_admin
    into v_cible
  from public.profiles
  where id = p_profile_id;

  if v_cible.id is null then
    raise exception 'PROFIL_INTROUVABLE';
  end if;

  -- Un Super Admin agit partout. Sinon il faut etre admin de la MEME
  -- entreprise que la personne visee.
  if not coalesce(v_appelant.is_super_admin, false) then
    if v_appelant.role is distinct from 'admin'
       or v_appelant.entreprise_id is null
       or v_appelant.entreprise_id is distinct from v_cible.entreprise_id then
      raise exception 'DROITS_INSUFFISANTS'
        using detail = 'Seul l''administrateur de l''entreprise peut regler les onglets visibles.';
    end if;
  end if;

  -- On ne restreint pas un Super Admin : il doit garder son acces complet.
  if coalesce(v_cible.is_super_admin, false) then
    raise exception 'CIBLE_SUPER_ADMIN'
      using detail = 'Les onglets d''un Super Admin ne se restreignent pas.';
  end if;

  update public.profiles
     set menus_autorises = case
           when p_menus is null or array_length(p_menus, 1) is null then null
           else p_menus
         end
   where id = p_profile_id;
end;
$$;

revoke execute on function public.definir_menus_autorises(uuid, text[]) from anon;
grant  execute on function public.definir_menus_autorises(uuid, text[]) to authenticated;

commit;

select 'colonne menus_autorises' as controle,
       (select count(*)::text from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name = 'menus_autorises') as valeur
union all
select 'fonction definir_menus_autorises',
       (select count(*)::text from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'definir_menus_autorises');
