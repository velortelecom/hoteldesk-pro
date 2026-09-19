-- =====================================================================
-- LE MODE SE CHOISIT PAR PERSONNE, PAS PAR ENTREPRISE
--
-- POURQUOI
--   « Suivre le pointage ou appliquer une plage horaire » etait un
--   reglage d'entreprise. C'etait trop grossier : dans la meme boite, un
--   chauffeur pointe son arrivee et son depart, un commercial en
--   rendez-vous toute la journee ne pointe peut-etre jamais. Leur
--   imposer la meme regle rendait l'une des deux fausse.
--
-- OU ON LE RANGE, ET POURQUOI PAS UNE TABLE A PART
--   Dans la ligne d'inscription. « On a decide que cette personne suit
--   son pointage » est une decision de meme nature que « on a decide de
--   la suivre » : elle a une date et un auteur, et elle doit pouvoir se
--   relire dans l'ordre.
--
--   Une table de reglages separee aurait perdu ca : on saurait le
--   reglage actuel, pas depuis quand ni par qui. Or c'est exactement ce
--   qu'on veut pouvoir repondre a un salarie qui demande des comptes.
--
-- LA CASCADE S'ALLONGE D'UN CRAN, SANS TROU
--   1. Le mode de la PERSONNE, s'il a ete choisi.
--   2. Sinon le reglage de l'ENTREPRISE.
--   3. Sinon : le pointage prime (il est exact la ou la plage
--      approxime).
--
--   Les inscriptions deja en base n'ont pas de mode : elles restent a
--   NULL et retombent sur l'entreprise. On ne leur invente pas une
--   valeur retroactive.
--
-- COCHE MAIS NE POINTE JAMAIS ?
--   Rien ne casse : est_en_temps_de_travail ne trouve aucun pointage et
--   retombe sur la plage horaire. Le reglage dit « prefere le
--   pointage », pas « exige le pointage ».
-- =====================================================================

begin;

alter table public.geolocalisation_inscriptions
  add column if not exists suivre_pointage boolean;

comment on column public.geolocalisation_inscriptions.suivre_pointage is
  'Pour CETTE personne : true = ses bornes sont son arrivee et son '
  'depart pointes ; false = la plage horaire de l''entreprise ; '
  'NULL = pas de choix, on suit l''entreprise.';

-- ---------------------------------------------------------------------
-- LE MODE ACTUEL D'UNE PERSONNE
--
-- Renvoie la source de la decision en plus de sa valeur : un ecran doit
-- pouvoir dire « choisi pour lui » ou « herite de l'entreprise », sinon
-- personne ne comprend pourquoi une case est cochee.
-- ---------------------------------------------------------------------
drop function if exists public.mode_geolocalisation(uuid);

create function public.mode_geolocalisation(p_profile_id uuid)
returns table (suivre_pointage boolean, origine text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_personne boolean;
  v_entreprise boolean;
begin
  select i.suivre_pointage into v_personne
  from public.geolocalisation_inscriptions i
  where i.profile_id = p_profile_id
    and i.suivre_pointage is not null
  order by i.decide_le desc, i.id desc
  limit 1;

  if v_personne is not null then
    return query select v_personne, 'personne'::text;
    return;
  end if;

  select g.suivre_pointage into v_entreprise
  from public.geolocalisation_parametres g
  join public.profiles p on p.entreprise_id = g.entreprise_id
  where p.id = p_profile_id;

  if v_entreprise is not null then
    return query select v_entreprise, 'entreprise'::text;
    return;
  end if;

  -- Rien de choisi nulle part : le pointage prime, parce qu'il est
  -- exact la ou la plage n'est qu'une approximation.
  return query select true, 'defaut'::text;
end $$;

-- ---------------------------------------------------------------------
-- est_en_temps_de_travail lit desormais le mode de la PERSONNE
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
  v_entreprise   uuid;
  v_params       record;
  v_mode         record;
  v_dernier      record;
  v_heures       numeric;
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

  select * into v_mode from public.mode_geolocalisation(p_profile_id);

  -- 1. LE POINTAGE, si c'est le mode de CETTE personne.
  if v_mode.suivre_pointage then
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

        return query select false, 'pointage'::text,
          'Arrivee il y a ' || round(v_heures) || ' h sans depart : journee invraisemblable, suivi interrompu.';
        return;
      end if;

      return query select false, 'pointage'::text,
        'Hors service depuis le ' || to_char(v_dernier.horodatage_evenement, 'DD/MM a HH24:MI') || '.';
      return;
    end if;
    -- Coche mais aucun pointage : on retombe sur la plage. Le reglage
    -- dit « prefere le pointage », pas « exige le pointage ».
  end if;

  -- 2. LA PLAGE HORAIRE. Toujours une reponse.
  v_heure_locale := (p_instant at time zone 'Europe/Paris')::time;

  if v_params.entreprise_id is null then
    v_params.plage_debut := '06:00'::time;
    v_params.plage_fin   := '22:00'::time;
  end if;

  if v_params.plage_debut <= v_params.plage_fin then
    if v_heure_locale >= v_params.plage_debut and v_heure_locale < v_params.plage_fin then
      return query select true, 'plage'::text,
        'Dans la plage ' || to_char(v_params.plage_debut, 'HH24:MI') || '-' || to_char(v_params.plage_fin, 'HH24:MI') || '.';
      return;
    end if;
  else
    -- Plage a cheval sur minuit. Sans ce cas, un poste de nuit ne
    -- serait JAMAIS dans sa plage.
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
-- INSCRIRE, AVEC SON MODE
--
-- Une nouvelle ligne est ecrite des que l'inscription OU le mode
-- change. Sans ce second cas, cocher la case n'aurait rien enregistre
-- et le reglage serait reste a l'ancienne valeur -- en silence.
-- ---------------------------------------------------------------------
drop function if exists public.inscrire_geolocalisation(uuid, boolean, text);
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

  select * into v_mode_actuel from public.mode_geolocalisation(p_profile_id);

  v_change := public.est_geolocalise(p_profile_id) is distinct from p_inscrit
              or (p_suivre_pointage is not null
                  and p_suivre_pointage is distinct from v_mode_actuel.suivre_pointage);

  -- Rien de change : on n'ecrit pas. Une ligne qui ne raconte rien
  -- encombre l'historique qu'on est justement cense pouvoir relire.
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

commit;

-- =====================================================================
-- CONTROLE -- lire ces lignes, pas le mot « Success ».
-- =====================================================================
select 'Colonne du mode par personne' as controle,
       coalesce((select data_type from information_schema.columns
                  where table_schema='public'
                    and table_name='geolocalisation_inscriptions'
                    and column_name='suivre_pointage'), 'ABSENTE') as valeur,
       'boolean' as attendu
union all
select 'Defaut sans rien de choisi',
       (select suivre_pointage::text || ' / ' || origine
          from public.mode_geolocalisation('00000000-0000-0000-0000-000000000000'::uuid)),
       'true / defaut'
union all
select 'inscrire_geolocalisation accepte le mode',
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname='public' and p.proname='inscrire_geolocalisation'
           and pg_get_function_identity_arguments(p.oid) like '%boolean, text, boolean%'),
       '1'
union all
select 'Inscriptions existantes laissees sans mode',
       (select count(*)::text from public.geolocalisation_inscriptions where suivre_pointage is null),
       'on ne leur invente pas de valeur';
