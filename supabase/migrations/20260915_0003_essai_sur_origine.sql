-- ============================================================================
-- VELOR ONE / HÔTELDESK PRO
-- Resserre le déclencheur d'essai 14 j sur l'origine de l'inscription
--
-- ⚠️ À N'APPLIQUER QU'APRÈS 20260915_inscription_publique_plan1.sql,
--    qui crée la colonne entreprises.origine.
--
-- À placer dans : supabase/migrations/20260915_0003_essai_sur_origine.sql
-- ============================================================================

-- ############################################################################
-- POURQUOI
--
-- La version initiale déclenchait l'essai sur plan = 'starter'. C'était un
-- pis-aller : au moment où elle a été écrite, aucune colonne ne disait d'où
-- venait une entreprise. Conséquence : un client starter que tu crées
-- toi-même depuis le back-office héritait d'un essai de 14 jours, puis
-- basculait en lecture seule sans que personne l'ait voulu.
--
-- entreprises.origine règle ça proprement :
--   'inscription_autonome' -> venu de /inscription        -> essai 14 j
--   'super_admin'          -> créé par toi au back-office -> aucun essai
-- ############################################################################

create or replace function public.set_essai_14j()
returns trigger
language plpgsql
as $$
begin
  if new.date_fin_abonnement is null
     and new.origine = 'inscription_autonome' then
    new.date_fin_abonnement := now() + interval '14 days';
  end if;
  return new;
end;
$$;

-- Le trigger lui-même ne change pas, il est déjà posé.
-- Rappel de sa définition, pour que ce fichier soit rejouable seul :
drop trigger if exists trg_essai_14j on public.entreprises;

create trigger trg_essai_14j
before insert on public.entreprises
for each row
execute function public.set_essai_14j();


-- ############################################################################
-- CONTRÔLE — à lancer après coup
-- ############################################################################

-- 1. Une inscription autonome reçoit bien 14 jours,
--    une création back-office n'en reçoit aucun.
--    Test sans résidu : tout est annulé par le rollback.
/*
begin;

insert into public.entreprises (nom, plan, secteur, origine)
values ('ZZ-AUTONOME', 'starter', 'hotel', 'inscription_autonome');

insert into public.entreprises (nom, plan, secteur, origine)
values ('ZZ-BACKOFFICE', 'starter', 'hotel', 'super_admin');

select nom,
       origine,
       date_fin_abonnement,
       (date_fin_abonnement::date - now()::date) as jours_restants
from public.entreprises
where nom like 'ZZ-%'
order by nom;
-- attendu : ZZ-AUTONOME = 14 jours | ZZ-BACKOFFICE = null

rollback;
*/


-- ############################################################################
-- SUIVI DES ESSAIS — qui rappeler, et quand
-- C'est la requête métier derrière ton onglet Demandes.
-- ############################################################################

select e.nom,
       e.telephone,
       e.email_contact,
       e.nombre_employes,
       e.date_fin_abonnement,
       (e.date_fin_abonnement::date - now()::date) as jours_restants,
       case
         when e.date_fin_abonnement is null            then 'client etabli'
         when e.date_fin_abonnement > now()            then 'essai en cours'
         else                                               'essai termine'
       end                                            as statut
from public.entreprises e
where e.origine = 'inscription_autonome'
order by e.date_fin_abonnement;
