-- =====================================================================
-- 20260917_0004 : le pointage redevient un module d'HEURES
--
-- POURQUOI
--   Deux choses etaient melangees : compter les heures de travail, et
--   savoir ou se trouve un technicien en itinerance. Ce sont deux
--   modules distincts (le registre declare deja 'pointage' et 'gps').
--   Cette migration sort le pointage de sa dependance au GPS.
--
-- CE QU'ELLE CORRIGE
--
--   1. UNE CONTRADICTION. entreprise_parametres_pointage.gps_obligatoire
--      laisse chaque entreprise decider si le GPS est exige. Mais la
--      contrainte pointages_methode_check imposait methode = 'gps' pour
--      TOUTE ligne. Le reglage ne servait donc a rien : une receptionniste
--      derriere son comptoir devait livrer sa position pour dire qu'elle
--      etait arrivee. On elargit la contrainte.
--
--   2. UN TROU. Aucune politique UPDATE n'existait sur pointages. Valider
--      une correction ne pouvait donc pas repasser le pointage en
--      'corrige' : PostgREST aurait renvoye zero ligne SANS erreur, et
--      l'ecran aurait affiche un succes imaginaire. C'est le silence qui
--      nous a coute deux jours sur les taches.
--
-- QUI PEUT MODIFIER UN POINTAGE
--   L'admin, et le responsable d'un departement pour les gens de son
--   departement -- la meme regle que corrections_pointage_update, deja en
--   place. Volontairement PAS le salarie lui-meme : on ne corrige pas ses
--   propres heures, on demande une correction. Sinon la feuille d'heures
--   ne vaut plus comme preuve.
--
--   Aucune politique DELETE n'est creee : un pointage ne s'efface pas.
--   Une erreur se corrige et garde sa trace.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Le pointage n'est plus force au GPS
--     gps        : pointage geolocalise, verifie contre la zone du site
--     navigateur : pointage depuis l'application, sans position
--     manuel     : saisi par un responsable (regularisation)
-- ---------------------------------------------------------------------
alter table public.pointages
  drop constraint if exists pointages_methode_check;

alter table public.pointages
  add constraint pointages_methode_check
  check (methode = any (array['gps'::text, 'navigateur'::text, 'manuel'::text]));

-- Le defaut devient 'navigateur'. C'etait 'gps' -- c'est-a-dire que toute
-- ligne inseree sans preciser la methode se declarait geolocalisee alors
-- qu'elle ne portait aucune position. Compter les heures est le cas
-- normal ; la position est l'exception, reservee aux itinerants.
alter table public.pointages
  alter column methode set default 'navigateur';

-- ---------------------------------------------------------------------
-- 2. La modification d'un pointage devient possible -- pour les bonnes
--    personnes seulement.
-- ---------------------------------------------------------------------
drop policy if exists pointages_update on public.pointages;

create policy pointages_update on public.pointages
  for update
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
              and ed_employe.profile_id = pointages.profile_id
          )
        )
      )
    )
  )
  -- WITH CHECK repete la condition : sans lui, un responsable pourrait
  -- deplacer un pointage vers une autre entreprise.
  with check (
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
              and ed_employe.profile_id = pointages.profile_id
          )
        )
      )
    )
  );

commit;

-- ---------------------------------------------------------------------
-- 3. Verification : ce que la base repond vraiment apres la migration.
--    Les politiques INSERT ne sont PAS touchees ici -- l'export ne
--    montrait aucune condition, et je ne modifie pas une regle de
--    securite sur une supposition. Ce SELECT dit la verite.
-- ---------------------------------------------------------------------
select tablename,
       policyname,
       cmd,
       coalesce(qual, '(AUCUNE CONDITION)')       as condition_lecture,
       coalesce(with_check, '(AUCUNE CONDITION)') as condition_ecriture
from pg_policies
where schemaname = 'public'
  and tablename in ('pointages', 'corrections_pointage', 'entreprise_parametres_pointage')
order by tablename, cmd, policyname;

-- ---------------------------------------------------------------------
-- 4. Les methodes actives : le pointage sans position devient le defaut
--
-- methodes_actives valait '{"gps": true}'. La fonction create-pointage
-- refuse toute methode absente de cet objet (methode_disabled), donc une
-- entreprise deja parametree n'aurait PAS pu pointer sans GPS, meme avec
-- la contrainte elargie ci-dessus. La migration serait passee et rien
-- n'aurait change a l'ecran.
--
-- On ajoute 'navigateur' sans retirer ce qui existe : une entreprise qui
-- avait active le GPS le garde.
-- ---------------------------------------------------------------------
alter table public.entreprise_parametres_pointage
  alter column methodes_actives set default '{"navigateur": true, "gps": false}'::jsonb;

do $$
declare v_maj integer;
begin
  update public.entreprise_parametres_pointage
     set methodes_actives = methodes_actives || '{"navigateur": true}'::jsonb
   where coalesce(methodes_actives->>'navigateur', 'false') <> 'true';

  get diagnostics v_maj = row_count;
  raise notice 'Entreprises autorisees a pointer sans GPS : %', v_maj;
end $$;
