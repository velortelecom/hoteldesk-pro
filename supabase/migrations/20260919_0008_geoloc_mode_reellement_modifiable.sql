-- supabase/migrations/20260919_0008_geoloc_mode_reellement_modifiable.sql
-- =====================================================================
-- LA CASE « SUIT SON POINTAGE » NE POUVAIT PAS ETRE COCHEE.
--
-- CE QUI SE PASSAIT
--   inscrire_geolocalisation comparait la valeur demandee au mode
--   EFFECTIF, celui que renvoie mode_geolocalisation() apres avoir
--   applique les replis : choix de la personne, sinon reglage de
--   l'entreprise, sinon « true » par defaut.
--
--   Pour quelqu'un qui n'avait aucun choix enregistre, ce mode effectif
--   valait donc deja true. Cocher la case demandait true. true n'est
--   pas distinct de true -> « rien n'a change », aucune ecriture, et la
--   case revenait decochee. Indefiniment.
--
--   Le premier clic etait le seul impossible : une fois une valeur
--   explicite posee, les suivants marchaient. C'est le genre de bug
--   qu'on met une heure a croire.
--
-- CE QU'ON COMPARE MAINTENANT
--   La valeur REELLEMENT STOCKEE pour cette personne, qui peut etre
--   null -- « aucun choix ». Poser explicitement un choix qui coincide
--   avec le defaut EST un changement : il fige le reglage, et il
--   survivra a une modification du reglage de l'entreprise.
--
-- ET L'ECRAN MENTAIT AUSSI
--   Il affichait « reglage de l'entreprise », case decochee, alors que
--   le systeme allait bel et bien suivre le pointage. La case disait le
--   contraire de ce qui allait se passer. modes_geolocalisation_entreprise()
--   donne desormais a l'ecran le mode effectif ET son origine, pour
--   qu'il montre ce qui s'appliquera vraiment.
--
-- Rejouable : les deux fonctions sont remplacees, rien n'est efface.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. LA VALEUR STOCKEE, SANS AUCUN REPLI
--
-- Volontairement separee de mode_geolocalisation() : l'une repond
-- « qu'est-ce qui va s'appliquer ? », l'autre « qu'a-t-on decide pour
-- cette personne ? ». Les confondre est exactement ce qui a produit le
-- bug.
-- ---------------------------------------------------------------------
drop function if exists public.mode_geolocalisation_stocke(uuid);

create function public.mode_geolocalisation_stocke(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select i.suivre_pointage
  from public.geolocalisation_inscriptions i
  where i.profile_id = p_profile_id
    and i.suivre_pointage is not null
  order by i.decide_le desc, i.id desc
  limit 1;
$$;

comment on function public.mode_geolocalisation_stocke(uuid) is
  'Le choix EXPLICITE enregistre pour cette personne, ou null si aucun. '
  'Ne fait aucun repli : c''est mode_geolocalisation() qui en fait.';

revoke all on function public.mode_geolocalisation_stocke(uuid) from public;
revoke all on function public.mode_geolocalisation_stocke(uuid) from anon;
grant execute on function public.mode_geolocalisation_stocke(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. INSCRIRE : ON COMPARE AU STOCKE, PLUS A L'EFFECTIF
-- ---------------------------------------------------------------------
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
  v_entreprise    uuid;
  v_id            uuid;
  v_mode_stocke   boolean;
  v_change        boolean;
begin
  if not (is_super_admin() or get_my_role() = 'admin'::text) then
    raise exception 'Reserve a l''administrateur de l''entreprise.' using errcode = '42501';
  end if;

  select p.entreprise_id into v_entreprise
  from public.profiles p where p.id = p_profile_id;

  if v_entreprise is null then
    raise exception 'Profil introuvable.' using errcode = 'P0002';
  end if;

  if not is_super_admin() and v_entreprise is distinct from get_my_entreprise_id() then
    raise exception 'Ce profil n''appartient pas a votre entreprise.' using errcode = '42501';
  end if;

  v_mode_stocke := public.mode_geolocalisation_stocke(p_profile_id);

  -- On compare au STOCKE. Poser un choix explicite la ou il n'y en
  -- avait aucun est un changement, meme si ce choix coincide avec le
  -- defaut : il fige le reglage pour cette personne.
  v_change := public.est_geolocalise(p_profile_id) is distinct from p_inscrit
              or (p_suivre_pointage is not null
                  and p_suivre_pointage is distinct from v_mode_stocke);

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
-- 3. CE QUE L'ECRAN DOIT AFFICHER
--
-- Le mode qui S'APPLIQUERA, et d'ou il vient. Sans ca, l'ecran
-- recalculait les replis de son cote -- une seconde regle a maintenir,
-- et c'est toujours celle qu'on oublie de corriger.
--
-- Reserve a l'encadrement : savoir qui est suivi et comment n'est pas
-- une information de salarie.
-- ---------------------------------------------------------------------
drop function if exists public.modes_geolocalisation_entreprise();

create function public.modes_geolocalisation_entreprise()
returns table (
  profile_id      uuid,
  inscrit         boolean,
  suivre_pointage boolean,
  origine         text,
  choix_explicite boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entreprise uuid;
begin
  if not (is_super_admin() or get_my_role() in ('admin', 'responsable')) then
    raise exception 'Reserve a l''encadrement.' using errcode = '42501';
  end if;

  v_entreprise := get_my_entreprise_id();
  if v_entreprise is null then
    return;
  end if;

  return query
  select p.id,
         public.est_geolocalise(p.id),
         m.suivre_pointage,
         m.origine,
         public.mode_geolocalisation_stocke(p.id) is not null
  from public.profiles p
  cross join lateral public.mode_geolocalisation(p.id) m
  where p.entreprise_id = v_entreprise
    and coalesce(p.is_super_admin, false) = false;
end $$;

revoke all on function public.modes_geolocalisation_entreprise() from public;
revoke all on function public.modes_geolocalisation_entreprise() from anon;
grant execute on function public.modes_geolocalisation_entreprise() to authenticated;

commit;

-- =====================================================================
-- CONTROLE -- lire ces lignes, pas le mot « Success ».
-- =====================================================================
select 'Fonction mode_geolocalisation_stocke' as controle,
       case when to_regprocedure('public.mode_geolocalisation_stocke(uuid)') is null
            then 'ABSENTE' else 'presente' end as valeur,
       'presente' as attendu
union all
select 'Fonction modes_geolocalisation_entreprise',
       case when to_regprocedure('public.modes_geolocalisation_entreprise()') is null
            then 'ABSENTE' else 'presente' end,
       'presente'
union all
select 'inscrire_geolocalisation compare le STOCKE',
       case when pg_get_functiondef(to_regprocedure('public.inscrire_geolocalisation(uuid,boolean,text,boolean)'))
                 like '%mode_geolocalisation_stocke%'
            then 'oui' else 'NON - ancienne version' end,
       'oui'
union all
select 'Personnes avec un choix explicite de mode',
       count(*)::text,
       'informatif'
from public.geolocalisation_inscriptions
where suivre_pointage is not null;
