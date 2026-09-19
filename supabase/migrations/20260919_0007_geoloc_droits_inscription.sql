-- =====================================================================
-- QUI PEUT INSCRIRE QUELQU'UN AU SUIVI DE POSITION
--
-- LA REGLE
--   Super admin  : tout le monde.
--   Admin        : toute son entreprise.
--   Responsable  : SEULEMENT les gens de son departement.
--   Salarie      : personne, jamais -- pas meme lui-meme.
--
-- POURQUOI LE RESPONSABLE EST LIMITE A SON DEPARTEMENT
--   La premiere version lui interdisait tout : geolocaliser quelqu'un
--   est une decision d'employeur. Rayan a tranche autrement, et c'est
--   defendable -- un chef d'equipe terrain sait qui part en tournee, et
--   l'admin n'est pas joignable a 6h du matin.
--
--   Mais lui donner la portee de l'admin lui permettrait d'inscrire la
--   comptabilite. Le decoupage par departement est celui qui existe
--   deja partout ailleurs dans le produit : il voit les heures de son
--   equipe, il corrige les pointages de son equipe, il inscrit les gens
--   de son equipe. Une regle de plus qui ressemble aux autres est une
--   regle qu'on retient.
--
-- POURQUOI LE SALARIE NE PEUT PAS S'INSCRIRE LUI-MEME
--   Pas par mefiance : parce qu'une inscription qu'on peut se donner
--   soi-meme peut aussi se retirer soi-meme. Le dispositif ne vaudrait
--   plus rien, et le premier a s'en apercevoir serait celui qui a
--   quelque chose a cacher.
-- =====================================================================

begin;

drop function if exists public.inscrire_geolocalisation(uuid, boolean, text, boolean);

create function public.inscrire_geolocalisation(
  p_profile_id      uuid,
  p_inscrit         boolean,
  p_motif           text default null,
  p_suivre_pointage boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entreprise  uuid;
  v_id          uuid;
  v_mode_actuel record;
  v_change      boolean;
  v_role        text := get_my_role();
  v_autorise    boolean := false;
begin
  select p.entreprise_id into v_entreprise
  from public.profiles p where p.id = p_profile_id;

  if v_entreprise is null then
    raise exception 'Profil introuvable.' using errcode = 'P0002';
  end if;

  -- ------------------------------------------------------------------
  -- LES DROITS, dans l'ordre du plus large au plus etroit.
  -- ------------------------------------------------------------------
  if is_super_admin() then
    v_autorise := true;

  elsif v_role = 'admin'::text then
    v_autorise := v_entreprise is not distinct from get_my_entreprise_id();

  elsif v_role = 'responsable'::text then
    -- Meme jointure que pour les heures et les corrections : il faut
    -- partager un departement avec la personne concernee.
    v_autorise := v_entreprise is not distinct from get_my_entreprise_id()
      and exists (
        select 1
        from public.employe_departements ed_responsable
        join public.employe_departements ed_employe
          on ed_employe.departement_id = ed_responsable.departement_id
        where ed_responsable.profile_id = auth.uid()
          and ed_employe.profile_id = p_profile_id
      );
  end if;

  -- Un salarie tombe ici quoi qu'il arrive, y compris pour lui-meme.
  if not v_autorise then
    raise exception 'Inscrire quelqu''un au suivi de position est reserve a '
                    'l''administrateur, ou au responsable pour son departement.'
      using errcode = '42501';
  end if;

  select * into v_mode_actuel from public.mode_geolocalisation(p_profile_id);

  v_change := public.est_geolocalise(p_profile_id) is distinct from p_inscrit
              or (p_suivre_pointage is not null
                  and p_suivre_pointage is distinct from v_mode_actuel.suivre_pointage);

  if not v_change then
    return null;
  end if;

  insert into public.geolocalisation_inscriptions
    (entreprise_id, profile_id, inscrit, motif, suivre_pointage, decide_par)
  values (v_entreprise, p_profile_id, p_inscrit, p_motif, p_suivre_pointage, auth.uid())
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.inscrire_geolocalisation(uuid, boolean, text, boolean) from public;
revoke all on function public.inscrire_geolocalisation(uuid, boolean, text, boolean) from anon;
grant execute on function public.inscrire_geolocalisation(uuid, boolean, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- LA LECTURE SUIT LE MEME DECOUPAGE
--
-- L'admin voit les inscriptions de son entreprise, le responsable
-- celles de son departement, et chacun voit la sienne -- savoir qu'on
-- est suivi n'est pas une faveur, c'est la condition pour que le
-- dispositif soit licite.
-- ---------------------------------------------------------------------
drop policy if exists geoloc_inscriptions_select on public.geolocalisation_inscriptions;
create policy geoloc_inscriptions_select on public.geolocalisation_inscriptions
  for select
  using (
    is_super_admin()
    or profile_id = auth.uid()
    or (
      entreprise_id = get_my_entreprise_id()
      and (
        get_my_role() = 'admin'::text
        or (
          get_my_role() = 'responsable'::text
          and exists (
            select 1
            from employe_departements ed_responsable
            join employe_departements ed_employe
              on ed_employe.departement_id = ed_responsable.departement_id
            where ed_responsable.profile_id = auth.uid()
              and ed_employe.profile_id = geolocalisation_inscriptions.profile_id
          )
        )
      )
    )
  );

commit;

-- =====================================================================
-- CONTROLE -- lire ces lignes, pas le mot « Success ».
-- =====================================================================
select 'La fonction verifie les trois roles' as controle,
       case when pg_get_functiondef(to_regprocedure(
              'public.inscrire_geolocalisation(uuid,boolean,text,boolean)')) like '%responsable%'
            and pg_get_functiondef(to_regprocedure(
              'public.inscrire_geolocalisation(uuid,boolean,text,boolean)')) like '%is_super_admin%'
            then 'oui' else 'NON' end as valeur,
       'oui' as attendu
union all
select 'Le responsable est limite a son departement',
       case when pg_get_functiondef(to_regprocedure(
              'public.inscrire_geolocalisation(uuid,boolean,text,boolean)')) like '%employe_departements%'
            then 'oui' else 'NON' end,
       'oui'
union all
select 'Aucune ecriture directe sur les inscriptions',
       coalesce((select string_agg(cmd, ', ') from pg_policies
          where schemaname='public' and tablename='geolocalisation_inscriptions'
            and cmd <> 'SELECT'), 'aucune'),
       'aucune'
union all
select 'Le salarie voit sa propre inscription',
       case when (select qual::text from pg_policies
                   where schemaname='public' and tablename='geolocalisation_inscriptions'
                     and policyname='geoloc_inscriptions_select') like '%auth.uid()%'
            then 'oui' else 'NON' end,
       'oui';
