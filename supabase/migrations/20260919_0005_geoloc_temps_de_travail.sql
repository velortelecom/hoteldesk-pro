-- =====================================================================
-- ON NE RELEVE QUE PENDANT LE TEMPS DE TRAVAIL
--
-- LE PROBLEME
--   Une plage fixe « 9h-18h » ne marche pour personne de reel : les 3x8
--   tournent chaque semaine, un poste de nuit va de 22h a 6h, un
--   chauffeur n'a pas deux tournees identiques.
--
-- LA REPONSE : ON NE DEFINIT PAS LES HORAIRES, ON LES LIT
--   Le salarie pointe deja son arrivee et son depart. Entre les deux,
--   il est au travail -- quelle que soit son equipe. Aucun planning a
--   tenir a jour, donc aucun planning a oublier de mettre a jour.
--
--   L'argument juridique devient une donnee et non une declaration :
--   « on ne collecte que pendant le temps de travail, etabli par le
--   pointage du salarie lui-meme ».
--
-- LA CASCADE, SANS TROU
--   1. Le pointage dit qu'il est en service (arrivee sans depart,
--      moins de 15 h) -> on releve.
--   2. Sinon -> la plage horaire de l'entreprise fait foi.
--
--   Il n'y a PAS de troisieme cas, et c'est deliberé. Un etat « rien
--   n'est defini » nous ferait collecter 24 h sur 24 sans que personne
--   l'ait decide. La plage a donc une valeur d'usine (06:00-22:00) :
--   large, mais elle exclut la nuit, et elle est visible et modifiable.
--
-- QUINZE HEURES, ET ON COUPE
--   Un depart oublie laisserait quelqu'un « au travail » indefiniment,
--   et on releverait sa position toute la nuit. Au-dela de 15 h depuis
--   l'arrivee, la journee n'est plus vraisemblable : on cesse de
--   relever. C'est le meme raisonnement que DUREE_INVRAISEMBLABLE dans
--   le module pointage -- quand on ne sait plus, on ne devine pas.
--
-- CE QUE CA VEND
--   Les deux modules se renforcent : le pointage rend la geo precise,
--   la geo donne une raison de plus de prendre le pointage. Et la geo
--   reste utilisable seule, avec sa plage horaire.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. LA PLAGE HORAIRE DE L'ENTREPRISE
--
-- Une ligne par entreprise, creee a la demande. Les valeurs d'usine
-- sont larges exprès : mieux vaut une plage grossiere que personne ne
-- conteste qu'une plage serree qui empeche un releve legitime.
-- ---------------------------------------------------------------------
create table if not exists public.geolocalisation_parametres (
  entreprise_id   uuid primary key,
  -- Plage appliquee quand le pointage ne peut pas repondre.
  plage_debut     time not null default '06:00',
  plage_fin       time not null default '22:00',
  -- Quand le pointage est disponible, doit-il primer ? Oui par defaut :
  -- il est exact la ou la plage n'est qu'une approximation.
  suivre_pointage boolean not null default true,
  maj_le          timestamptz not null default now(),
  maj_par         uuid
);

comment on table public.geolocalisation_parametres is
  'Quand relever une position, pour les entreprises qui ne pointent pas. '
  'Le pointage, quand il existe, est plus exact et passe devant.';

alter table public.geolocalisation_parametres enable row level security;

drop policy if exists geoloc_parametres_select on public.geolocalisation_parametres;
create policy geoloc_parametres_select on public.geolocalisation_parametres
  for select
  using (is_super_admin() or entreprise_id = get_my_entreprise_id());

-- ---------------------------------------------------------------------
-- 2. AU-DELA DE COMBIEN D'HEURES ON NE CROIT PLUS LE POINTAGE
--
-- Une fonction plutot qu'un nombre recopie : l'ecran, la regle et la
-- mention d'information doivent citer le meme.
-- ---------------------------------------------------------------------
drop function if exists public.duree_service_invraisemblable_heures();

create function public.duree_service_invraisemblable_heures()
returns integer
language sql
immutable
as $$ select 15; $$;

-- ---------------------------------------------------------------------
-- 3. EST-IL AU TRAVAIL, MAINTENANT ?
--
-- Renvoie aussi la RAISON : l'ecran doit pouvoir expliquer pourquoi un
-- releve n'a pas eu lieu. « Rien ne s'est passe » est la reponse qui
-- fait perdre le plus de temps.
-- ---------------------------------------------------------------------
drop function if exists public.est_en_temps_de_travail(uuid, timestamptz);

create function public.est_en_temps_de_travail(
  p_profile_id uuid,
  p_instant    timestamptz default now()
)
returns table (au_travail boolean, source text, detail text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entreprise  uuid;
  v_params      record;
  v_dernier     record;
  v_heures      numeric;
  v_heure_locale time;
begin
  select p.entreprise_id into v_entreprise
  from public.profiles p where p.id = p_profile_id;

  if v_entreprise is null then
    return query select false, 'profil'::text, 'Profil sans entreprise.'::text;
    return;
  end if;

  select * into v_params
  from public.geolocalisation_parametres g
  where g.entreprise_id = v_entreprise;

  -- 1. LE POINTAGE, s'il peut repondre.
  if coalesce(v_params.suivre_pointage, true) then
    select pt.action, pt.horodatage_evenement into v_dernier
    from public.pointages pt
    where pt.profile_id = p_profile_id
      and pt.statut in ('accepte', 'corrige')
      and pt.horodatage_evenement <= p_instant
    order by pt.horodatage_evenement desc
    limit 1;

    if found then
      if v_dernier.action in ('arrivee', 'fin_pause') then
        v_heures := extract(epoch from (p_instant - v_dernier.horodatage_evenement)) / 3600;

        if v_heures <= public.duree_service_invraisemblable_heures() then
          return query select true, 'pointage'::text,
            'En service depuis ' || to_char(v_dernier.horodatage_evenement, 'DD/MM HH24:MI') || '.';
          return;
        end if;

        -- Depart oublie : on ne suit plus. Relever toute la nuit
        -- quelqu'un qui a juste oublie un bouton serait indefendable.
        return query select false, 'pointage'::text,
          'Arrivee il y a ' || round(v_heures) || ' h sans depart : journee invraisemblable, suivi interrompu.';
        return;
      end if;

      -- Dernier evenement = depart ou debut de pause : hors service.
      return query select false, 'pointage'::text,
        'Hors service depuis le ' || to_char(v_dernier.horodatage_evenement, 'DD/MM a HH24:MI') || '.';
      return;
    end if;
    -- Aucun pointage : on tombe sur la plage horaire ci-dessous.
  end if;

  -- 2. LA PLAGE HORAIRE. Toujours une reponse, jamais un trou.
  v_heure_locale := (p_instant at time zone 'Europe/Paris')::time;

  if v_params.entreprise_id is null then
    -- Pas de ligne de parametres : les valeurs d'usine s'appliquent.
    v_params.plage_debut := '06:00'::time;
    v_params.plage_fin   := '22:00'::time;
  end if;

  if v_params.plage_debut <= v_params.plage_fin then
    -- Plage normale : 06:00 -> 22:00
    if v_heure_locale >= v_params.plage_debut and v_heure_locale < v_params.plage_fin then
      return query select true, 'plage'::text,
        'Dans la plage ' || to_char(v_params.plage_debut, 'HH24:MI') || '-' || to_char(v_params.plage_fin, 'HH24:MI') || '.';
      return;
    end if;
  else
    -- Plage a cheval sur minuit : 22:00 -> 06:00. Sans ce cas, un poste
    -- de nuit ne serait JAMAIS dans sa plage.
    if v_heure_locale >= v_params.plage_debut or v_heure_locale < v_params.plage_fin then
      return query select true, 'plage'::text,
        'Dans la plage de nuit ' || to_char(v_params.plage_debut, 'HH24:MI') || '-' || to_char(v_params.plage_fin, 'HH24:MI') || '.';
      return;
    end if;
  end if;

  return query select false, 'plage'::text,
    'Hors de la plage ' || to_char(v_params.plage_debut, 'HH24:MI') || '-' || to_char(v_params.plage_fin, 'HH24:MI') || '.';
end $$;

-- ---------------------------------------------------------------------
-- 4. LE RELEVE REFUSE HORS TEMPS DE TRAVAIL
--
-- On reecrit la fonction pour y ajouter ce controle. Elle refuse
-- desormais quatre choses : non authentifie, non inscrit, position
-- absente, et hors temps de travail.
-- ---------------------------------------------------------------------
drop function if exists public.enregistrer_releve_position(text, uuid, double precision, double precision, double precision, uuid, text);

create function public.enregistrer_releve_position(
  p_action_type      text,
  p_action_id        uuid,
  p_latitude         double precision,
  p_longitude        double precision,
  p_precision_metres double precision default null,
  p_site_id          uuid default null,
  p_appareil         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil     uuid := auth.uid();
  v_entreprise uuid;
  v_travail    record;
  v_site       record;
  v_distance   double precision := null;
  v_dedans     boolean := null;
  v_id         uuid;
  c_rayon_terre constant double precision := 6371000;
begin
  if v_profil is null then
    raise exception 'Non authentifie.' using errcode = '42501';
  end if;

  if not public.est_geolocalise(v_profil) then
    raise exception 'Cette personne n''est pas inscrite au suivi de position.'
      using errcode = '42501';
  end if;

  -- LE CONTROLE AJOUTE ICI. Hors temps de travail, on n'enregistre
  -- rien -- et on dit pourquoi, pour que l'ecran ne laisse pas croire
  -- a une panne.
  select * into v_travail from public.est_en_temps_de_travail(v_profil);
  if not v_travail.au_travail then
    raise exception 'Hors temps de travail : aucun releve. %', v_travail.detail
      using errcode = '42501';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Position absente.' using errcode = '22023';
  end if;

  select p.entreprise_id into v_entreprise
  from public.profiles p where p.id = v_profil;

  if v_entreprise is null then
    raise exception 'Profil sans entreprise.' using errcode = 'P0002';
  end if;

  if p_site_id is not null then
    select s.id, s.latitude, s.longitude, s.rayon_pointage_metres
      into v_site
    from public.sites s
    where s.id = p_site_id and s.entreprise_id = v_entreprise;

    if found and v_site.latitude is not null and v_site.longitude is not null then
      v_distance := c_rayon_terre * 2 * asin(sqrt(
        power(sin(radians(p_latitude - v_site.latitude) / 2), 2)
        + cos(radians(v_site.latitude)) * cos(radians(p_latitude))
        * power(sin(radians(p_longitude - v_site.longitude) / 2), 2)
      ));
      v_dedans := v_distance <= coalesce(v_site.rayon_pointage_metres, 100);
    end if;
  end if;

  insert into public.releves_position (
    entreprise_id, profile_id, action_type, action_id,
    latitude, longitude, precision_metres,
    site_id, distance_site_metres, dans_le_rayon, appareil
  ) values (
    v_entreprise, v_profil, p_action_type, p_action_id,
    p_latitude, p_longitude, p_precision_metres,
    p_site_id, v_distance, v_dedans, p_appareil
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.enregistrer_releve_position(text, uuid, double precision, double precision, double precision, uuid, text) from public;
revoke all on function public.enregistrer_releve_position(text, uuid, double precision, double precision, double precision, uuid, text) from anon;
grant execute on function public.enregistrer_releve_position(text, uuid, double precision, double precision, double precision, uuid, text) to authenticated;

commit;

-- =====================================================================
-- CONTROLE -- lire ces lignes, pas le mot « Success ».
-- =====================================================================
select 'Seuil de journee invraisemblable' as controle,
       public.duree_service_invraisemblable_heures()::text as valeur,
       '15' as attendu
union all
select 'Table des plages horaires',
       case when to_regclass('public.geolocalisation_parametres') is null
            then 'ABSENTE' else 'presente' end,
       'presente'
union all
select 'Plage par defaut',
       (select column_default from information_schema.columns
         where table_schema='public' and table_name='geolocalisation_parametres'
           and column_name='plage_debut')
       || ' -> ' ||
       (select column_default from information_schema.columns
         where table_schema='public' and table_name='geolocalisation_parametres'
           and column_name='plage_fin'),
       '06:00 -> 22:00'
union all
select 'Le releve controle le temps de travail',
       case when pg_get_functiondef(to_regprocedure(
              'public.enregistrer_releve_position(text,uuid,double precision,double precision,double precision,uuid,text)'))
              like '%est_en_temps_de_travail%'
            then 'oui' else 'NON' end,
       'oui';
