-- ============================================================================
-- VELOR ONE / HÔTELDESK PRO
-- Abonnement : date de fin pilotable + renouvellement mensuel automatique
--
-- À coller dans le SQL Editor Supabase, puis à déposer dans
-- supabase/migrations/20260916_0002_abonnement_recurrent.sql
--
-- Idempotent : rejouable sans effet de bord.
-- ============================================================================


-- ############################################################################
-- 1. LE DRAPEAU DE RÉCURRENCE
-- ############################################################################

alter table public.entreprises
  add column if not exists abonnement_recurrent boolean not null default false;

comment on column public.entreprises.abonnement_recurrent is
  'true = date_fin_abonnement avance d''un mois automatiquement. false = a la date de fin, passage en lecture seule.';

-- Le grant UPDATE sur entreprises est au niveau table, donc la nouvelle
-- colonne en herite. On l'ecrit quand meme : ca ne coute rien et ca protege
-- d'un futur passage en droits par colonne.
grant update (abonnement_recurrent, date_fin_abonnement) on public.entreprises to authenticated;


-- ############################################################################
-- 2. LA FONCTION DE GARDE
--
-- Elle gouverne trg_lecture_seule sur les 19 tables metier.
--
-- Trois cas :
--   abonnement_recurrent = true   -> jamais bloque
--   date_fin_abonnement is null   -> jamais bloque (client etabli)
--   date_fin_abonnement > now()   -> ecriture permise
--   sinon                         -> lecture seule
--
-- ⚠️ Le premier cas est un filet de securite volontaire. Si le job de
-- renouvellement ne tourne pas une nuit, un client qui paie ne doit PAS se
-- retrouver verrouille. On accepte de laisser ecrire un jour de trop plutot
-- que de bloquer a tort un client en regle.
-- ############################################################################

create or replace function public.entreprise_ecriture_ouverte(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select e.actif
     and (
       e.abonnement_recurrent
       or coalesce(e.date_fin_abonnement > now(), true)
     )
  from public.entreprises e
  where e.id = eid
$$;

revoke execute on function public.entreprise_ecriture_ouverte(uuid) from anon;
grant  execute on function public.entreprise_ecriture_ouverte(uuid) to authenticated;


-- ############################################################################
-- 3. LE RENOUVELLEMENT
--
-- Avance date_fin_abonnement d'un mois pour chaque entreprise en recurrence
-- dont la date est atteinte. La boucle rattrape plusieurs mois si le job n'a
-- pas tourne pendant un moment : sans elle, une entreprise en retard de trois
-- mois resterait en retard de deux apres un passage.
-- ############################################################################

create or replace function public.renouveler_abonnements()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ligne    record;
  nouvelle timestamptz;
  n        integer := 0;
begin
  for ligne in
    select id, nom, date_fin_abonnement
    from public.entreprises
    where abonnement_recurrent
      and actif
      and date_fin_abonnement is not null
      and date_fin_abonnement <= now()
  loop
    nouvelle := ligne.date_fin_abonnement;
    while nouvelle <= now() loop
      nouvelle := nouvelle + interval '1 month';
    end loop;

    update public.entreprises
    set date_fin_abonnement = nouvelle
    where id = ligne.id;

    raise notice 'Abonnement renouvele : % -> %', ligne.nom, nouvelle;
    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke execute on function public.renouveler_abonnements() from anon, authenticated;


-- ############################################################################
-- 4. LA PLANIFICATION — pg_cron, tous les jours a 03h00 UTC
-- ############################################################################

do $$
begin
  perform cron.unschedule('renouvellement-abonnements');
exception
  when others then null;   -- premiere pose : le job n'existe pas encore
end
$$;

select cron.schedule(
  'renouvellement-abonnements',
  '0 3 * * *',
  $cron$ select public.renouveler_abonnements(); $cron$
);


-- ############################################################################
-- 5. CONTRÔLES
-- ############################################################################

select 'colonne abonnement_recurrent' as controle,
       (select count(*)::text from information_schema.columns
         where table_schema='public' and table_name='entreprises'
           and column_name='abonnement_recurrent') as valeur
union all
select 'garde tient compte de la recurrence',
       (select case when prosrc like '%abonnement_recurrent%' then 'oui' else 'NON' end
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='entreprise_ecriture_ouverte')
union all
select 'job planifie',
       coalesce((select schedule from cron.job where jobname='renouvellement-abonnements'), 'ABSENT')
union all
select 'triggers lecture seule (attendu 19)',
       (select count(*)::text from pg_trigger tg
          join pg_class c on c.oid = tg.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname='public' and tg.tgname='trg_lecture_seule'
           and not tg.tgisinternal);


-- ############################################################################
-- TEST À BLANC — verifie la logique sans rien laisser derriere
-- ############################################################################
/*
begin;

insert into public.entreprises (nom, plan, secteur, origine, date_fin_abonnement, abonnement_recurrent)
values ('ZZ-RECURRENT', 'starter', 'hotel', 'super_admin', now() - interval '2 months', true);

insert into public.entreprises (nom, plan, secteur, origine, date_fin_abonnement, abonnement_recurrent)
values ('ZZ-RESILIE',   'starter', 'hotel', 'super_admin', now() - interval '1 day',    false);

select nom,
       abonnement_recurrent,
       public.entreprise_ecriture_ouverte(id) as peut_ecrire
from public.entreprises where nom like 'ZZ-%' order by nom;
-- attendu : ZZ-RECURRENT = true (filet de securite) | ZZ-RESILIE = false

select public.renouveler_abonnements() as nb_renouvelees;
-- attendu : 1

select nom, date_fin_abonnement, (date_fin_abonnement > now()) as dans_le_futur
from public.entreprises where nom like 'ZZ-%' order by nom;
-- attendu : ZZ-RECURRENT rattrape ses 2 mois et repasse dans le futur

rollback;
*/


-- ############################################################################
-- ROLLBACK COMPLET
-- ############################################################################
-- select cron.unschedule('renouvellement-abonnements');
-- drop function if exists public.renouveler_abonnements();
-- create or replace function public.entreprise_ecriture_ouverte(eid uuid)
-- returns boolean language sql stable security definer set search_path = public as $$
--   select coalesce(e.date_fin_abonnement > now(), true) and e.actif
--   from public.entreprises e where e.id = eid
-- $$;
-- alter table public.entreprises drop column if exists abonnement_recurrent;
