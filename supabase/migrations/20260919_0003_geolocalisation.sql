-- =====================================================================
-- GEOLOCALISATION : OU LE TRAVAIL A ETE FAIT
--
-- LA FINALITE, ET ELLE EST ETROITE
--   On enregistre la position au moment d'une ACTION METIER -- une tache
--   terminee, une photo prise, une visite enregistree. Pas a la
--   connexion, pas en continu, pas en arriere-plan.
--
--   La difference n'est pas cosmetique. « On enregistre ou le travail a
--   ete fait » est une finalite ; « on voit ou sont les gens » n'en est
--   pas une, c'est un suivi permanent -- ce que la doctrine CNIL
--   n'admet que dans des cas tres particuliers, et pas celui-ci.
--
--   Consequence concrete : un salarie qui consulte l'application chez
--   lui un dimanche soir ne laisse AUCUN releve. Il n'a fait aucun acte
--   de travail.
--
-- QUI EST SUIVI : SEULEMENT CEUX QU'ON Y A INSCRITS
--   Une personne au bureau n'a pas besoin d'etre geolocalisee. On
--   n'active donc pas le module « pour l'entreprise » : on inscrit des
--   PERSONNES, une par une, et l'inscription est datee et signee de
--   celui qui l'a decidee.
--
--   Cette trace n'est pas un luxe administratif. Le jour ou un salarie
--   demande depuis quand il est suivi et qui l'a decide, la reponse doit
--   exister. Sans elle, c'est la parole de l'employeur contre la sienne.
--
-- LE REFUS EST DANS LA BASE, PAS DANS L'ECRAN
--   enregistrer_releve_position() refuse d'ecrire pour quelqu'un qui
--   n'est pas inscrit. Un ecran mal ecrit, un appel direct a l'API, une
--   version future distraite : aucun ne pourra geolocaliser quelqu'un
--   qui n'a pas ete inscrit explicitement.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. QUI EST INSCRIT AU SUIVI
--
-- Une suite de decisions, pas un simple booleen : inscrire puis retirer
-- puis reinscrire quelqu'un doit se lire dans l'ordre. Un booleen
-- ecraserait son propre passe -- meme raison que pour les mouvements
-- d'utilisateurs.
-- ---------------------------------------------------------------------
create table if not exists public.geolocalisation_inscriptions (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null,
  profile_id     uuid not null,
  inscrit        boolean not null,
  motif          text,
  decide_le      timestamptz not null default now(),
  decide_par     uuid
);

create index if not exists geoloc_inscriptions_profil_idx
  on public.geolocalisation_inscriptions (profile_id, decide_le desc);

comment on table public.geolocalisation_inscriptions is
  'Qui est suivi, depuis quand, et par decision de qui. Une suite de '
  'decisions : on n''ecrase jamais l''historique.';

-- ---------------------------------------------------------------------
-- 2. EST-CE QUE CETTE PERSONNE EST SUIVIE, MAINTENANT ?
--
-- La derniere decision fait foi. Aucune decision = non suivi : le
-- defaut d'un dispositif de surveillance est de ne pas s'appliquer.
-- ---------------------------------------------------------------------
drop function if exists public.est_geolocalise(uuid);

create function public.est_geolocalise(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select i.inscrit
    from public.geolocalisation_inscriptions i
    where i.profile_id = p_profile_id
    order by i.decide_le desc, i.id desc
    limit 1
  ), false);
$$;

-- ---------------------------------------------------------------------
-- 3. LES RELEVES
--
-- Chaque ligne porte l'ACTION qui l'a justifiee. Un releve sans action
-- n'a pas de raison d'exister, et la contrainte l'interdit : c'est ce
-- qui empeche le module de glisser vers le suivi permanent sans que
-- personne le decide.
-- ---------------------------------------------------------------------
create table if not exists public.releves_position (
  id                 uuid primary key default gen_random_uuid(),
  entreprise_id      uuid not null,
  profile_id         uuid not null,

  -- CE QUI JUSTIFIE LE RELEVE. Obligatoire.
  action_type        text not null
                     check (action_type in ('tache_terminee', 'photo', 'visite', 'intervention_debut')),
  action_id          uuid,

  latitude           double precision not null,
  longitude          double precision not null,
  precision_metres   double precision,

  -- Comparaison au lieu attendu, quand il y en a un. C'est elle qui
  -- transforme « il etait quelque part » en « il etait chez le client ».
  site_id            uuid,
  distance_site_metres double precision,
  dans_le_rayon      boolean,

  -- Horodatage SERVEUR. Jamais celui du telephone : le changer prend
  -- dix secondes dans les reglages.
  releve_le          timestamptz not null default now(),
  appareil           text,

  constraint releves_position_latitude_valide  check (latitude  between -90  and 90),
  constraint releves_position_longitude_valide check (longitude between -180 and 180)
);

create index if not exists releves_position_profil_idx
  on public.releves_position (profile_id, releve_le desc);
create index if not exists releves_position_entreprise_idx
  on public.releves_position (entreprise_id, releve_le desc);

comment on table public.releves_position is
  'Ou le travail a ete fait. Un releve par ACTION METIER, jamais par '
  'connexion : une position sans acte de travail n''a pas a exister.';

-- ---------------------------------------------------------------------
-- 4. ECRIRE UN RELEVE -- le seul chemin
--
-- SECURITY DEFINER, et il refuse trois choses :
--   - une personne non inscrite au suivi ;
--   - un releve pour quelqu'un d'autre que soi ;
--   - une position absente.
--
-- La distance au site est calculee ICI, a partir des coordonnees du
-- site en base. La faire calculer par le telephone reviendrait a lui
-- demander s'il est au bon endroit.
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
  v_profil    uuid := auth.uid();
  v_entreprise uuid;
  v_site      record;
  v_distance  double precision := null;
  v_dedans    boolean := null;
  v_id        uuid;
  c_rayon_terre constant double precision := 6371000;
begin
  if v_profil is null then
    raise exception 'Non authentifie.' using errcode = '42501';
  end if;

  -- Le cœur du dispositif : pas d'inscription, pas de releve.
  if not public.est_geolocalise(v_profil) then
    raise exception 'Cette personne n''est pas inscrite au suivi de position.'
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
      -- Haversine. La meme formule que create-pointage, mais ici c'est
      -- la base qui la tient : le client ne calcule jamais sa propre
      -- conformite.
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

-- ---------------------------------------------------------------------
-- 5. INSCRIRE OU RETIRER QUELQU'UN
--
-- Reserve a l'admin de l'entreprise et au super admin. Un responsable
-- ne decide pas seul de geolocaliser quelqu'un : c'est une decision
-- d'employeur, pas d'encadrement d'equipe.
-- ---------------------------------------------------------------------
drop function if exists public.inscrire_geolocalisation(uuid, boolean, text);

create function public.inscrire_geolocalisation(
  p_profile_id uuid,
  p_inscrit    boolean,
  p_motif      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entreprise uuid;
  v_id         uuid;
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

  -- Sans changement, on n'ecrit rien : reinscrire quelqu'un deja
  -- inscrit remplirait l'historique de lignes qui ne racontent rien.
  if public.est_geolocalise(p_profile_id) = p_inscrit then
    return null;
  end if;

  insert into public.geolocalisation_inscriptions
    (entreprise_id, profile_id, inscrit, motif, decide_par)
  values (v_entreprise, p_profile_id, p_inscrit, p_motif, auth.uid())
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.inscrire_geolocalisation(uuid, boolean, text) from public;
revoke all on function public.inscrire_geolocalisation(uuid, boolean, text) from anon;
grant execute on function public.inscrire_geolocalisation(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. QUI PEUT LIRE
--
-- Meme decoupage que pour les heures : l'admin de l'entreprise, et le
-- responsable pour les gens de son departement. Aucune politique
-- d'ecriture : tout passe par les fonctions ci-dessus.
--
-- Aucune politique DELETE non plus. Un releve ne s'efface pas a la
-- main ; sa duree de conservation se purgera par une tache dediee,
-- ecrite quand la duree aura ete decidee.
-- ---------------------------------------------------------------------
alter table public.releves_position enable row level security;
alter table public.geolocalisation_inscriptions enable row level security;

drop policy if exists releves_position_select on public.releves_position;
create policy releves_position_select on public.releves_position
  for select
  using (
    is_super_admin()
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
              and ed_employe.profile_id = releves_position.profile_id
          )
        )
      )
    )
  );

drop policy if exists geoloc_inscriptions_select on public.geolocalisation_inscriptions;
create policy geoloc_inscriptions_select on public.geolocalisation_inscriptions
  for select
  using (
    is_super_admin()
    or (entreprise_id = get_my_entreprise_id() and get_my_role() = 'admin'::text)
    -- Le salarie voit SA propre inscription. Savoir qu'on est suivi
    -- n'est pas une faveur : c'est la condition pour que le dispositif
    -- soit licite.
    or profile_id = auth.uid()
  );

commit;

-- =====================================================================
-- CONTROLE -- lire ces lignes, pas le mot « Success ».
-- =====================================================================
select 'Table des inscriptions' as controle,
       case when to_regclass('public.geolocalisation_inscriptions') is null
            then 'ABSENTE' else 'presente' end as valeur,
       'presente' as attendu
union all
select 'Table des releves',
       case when to_regclass('public.releves_position') is null then 'ABSENTE' else 'presente' end,
       'presente'
union all
select 'Personne n est suivi par defaut',
       public.est_geolocalise('00000000-0000-0000-0000-000000000001'::uuid)::text,
       'false'
union all
select 'Un releve exige une action connue',
       (select count(*)::text from pg_constraint
         where conrelid = 'public.releves_position'::regclass
           and conname = 'releves_position_action_type_check'),
       '1'
union all
select 'Aucune ecriture directe autorisee',
       coalesce((select string_agg(cmd, ', ') from pg_policies
          where schemaname = 'public' and tablename = 'releves_position'
            and cmd <> 'SELECT'), 'aucune'),
       'aucune'
union all
select 'Personnes actuellement suivies',
       (select count(*)::text from public.profiles p where public.est_geolocalise(p.id)),
       '0 au premier passage';
