-- =====================================================================
-- VELOR ONE / HOTELDESK PRO
-- Le pointage redevient un module d'HEURES, independant du GPS.
--
-- A COLLER EN UNE SEULE FOIS dans l'editeur SQL Supabase (Ctrl+A, Ctrl+V,
-- Run). Le dernier bloc est un controle : il AFFICHE ce que la base
-- repond vraiment apres la migration. Ne pas s'arreter au « Success » --
-- lire les lignes.
--
-- Rejouable sans dommage : passer ce fichier deux fois donne le meme
-- resultat qu'une fois.
--
-- POURQUOI
--   Deux choses etaient melangees : compter les heures de travail, et
--   savoir ou se trouve un technicien en itinerance. Le registre declare
--   deja deux modules distincts ('pointage' et 'gps'). Cette migration
--   sort le pointage de sa dependance au GPS.
--
-- CE QU'ELLE CORRIGE
--   1. UNE CONTRADICTION. entreprise_parametres_pointage.gps_obligatoire
--      laisse chaque entreprise decider si le GPS est exige. Mais
--      pointages_methode_check imposait methode = 'gps' pour TOUTE ligne.
--      Le reglage ne servait donc a rien : une receptionniste derriere son
--      comptoir devait livrer sa position pour dire qu'elle etait arrivee.
--
--   2. UN TROU. Aucune politique UPDATE n'existait sur pointages. Valider
--      une correction ne pouvait donc pas repasser le pointage en
--      'corrige' : PostgREST aurait renvoye zero ligne SANS erreur, et
--      l'ecran aurait affiche un succes imaginaire.
--
--   3. UN VERROU INVISIBLE. methodes_actives valait '{"gps": true}'. La
--      fonction create-pointage refuse toute methode absente de cet objet,
--      donc une entreprise deja parametree n'aurait PAS pu pointer sans
--      GPS meme avec la contrainte elargie. La migration serait passee et
--      rien n'aurait change a l'ecran.
--
-- QUI PEUT MODIFIER UN POINTAGE
--   L'admin, et le responsable d'un departement pour les gens de son
--   departement -- la meme regle que corrections_pointage_update, deja en
--   place. Volontairement PAS le salarie lui-meme : on ne corrige pas ses
--   propres heures, on demande une correction. Sinon la feuille d'heures
--   ne vaut plus comme preuve (art. D.3171-8).
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

-- ---------------------------------------------------------------------
-- 3. Les methodes actives : pointer sans position devient le defaut
--
-- On AJOUTE 'navigateur' sans retirer ce qui existe : une entreprise qui
-- avait active le GPS le garde. Un reglage deja bon n'est pas retouche.
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
  raise notice 'Entreprises ouvertes au pointage sans GPS : %', v_maj;
end $$;

commit;

-- =====================================================================
-- 4. CONTROLE -- c'est ce tableau qu'il faut lire, pas le « Success ».
--
--    Quatre lignes. Chacune doit afficher OK. Une seule ligne A REVOIR
--    signifie que le pointage ne marchera pas, quoi qu'en dise l'ecran.
-- =====================================================================
with controles as (
  select 1 as n,
         'Methodes acceptees par la base' as controle,
         coalesce((
           select pg_get_constraintdef(c.oid)
           from pg_constraint c
           join pg_class t on t.oid = c.conrelid
           join pg_namespace s on s.oid = t.relnamespace
           where s.nspname = 'public'
             and t.relname = 'pointages'
             and c.conname = 'pointages_methode_check'
         ), 'CONTRAINTE ABSENTE') as valeur,
         'doit citer gps, navigateur et manuel' as attendu

  union all
  select 2,
         'Methode par defaut d une nouvelle ligne',
         coalesce((
           select column_default
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'pointages'
             and column_name = 'methode'
         ), '(aucun defaut)'),
         'doit valoir navigateur'

  union all
  select 3,
         'Politique UPDATE sur pointages',
         coalesce((
           select string_agg(policyname, ', ')
           from pg_policies
           where schemaname = 'public'
             and tablename = 'pointages'
             and cmd = 'UPDATE'
         ), 'AUCUNE'),
         'doit exister, sinon les corrections echouent en silence'

  union all
  select 4,
         'Entreprises pouvant pointer sans GPS',
         (
           select count(*) filter (where methodes_actives->>'navigateur' = 'true')
                  || ' sur ' || count(*)
           from public.entreprise_parametres_pointage
         ),
         'les deux nombres doivent etre egaux'
)
select controle,
       valeur,
       case
         when n = 1 then case when valeur like '%navigateur%' and valeur like '%manuel%' and valeur like '%gps%'
                              then 'OK' else 'A REVOIR' end
         when n = 2 then case when valeur like '%navigateur%' then 'OK' else 'A REVOIR' end
         when n = 3 then case when valeur <> 'AUCUNE' then 'OK' else 'A REVOIR' end
         else case when split_part(valeur, ' sur ', 1) = split_part(valeur, ' sur ', 2)
                   then 'OK' else 'A REVOIR' end
       end as verdict,
       attendu
from controles
order by n;
