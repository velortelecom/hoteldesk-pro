-- ============================================================================
-- VELOR ONE / HÔTELDESK PRO
-- Essai gratuit 14 jours + passage en lecture seule à l'expiration
--
-- ⚠️ CE SCRIPT EST DÉJÀ APPLIQUÉ EN PRODUCTION (projet vcpnrisxbnvyupsbieie,
--    branche main, le 15/09/2026). Il est ici pour être versionné dans Git,
--    conformément à la règle « toute modif Supabase repart dans le dépôt ».
--
-- À placer dans : supabase/migrations/20260915_0002_essai_14j_lecture_seule.sql
-- Le préfixe _0002_ le fait trier après 20260915_0001 et avant
-- 20260915_inscription_publique_plan1.sql si tu renommes ce dernier.
--
-- Entièrement idempotent : rejouable sans effet de bord.
-- ============================================================================


-- ############################################################################
-- 1. ESSAI 14 JOURS
--    Pose date_fin_abonnement = now() + 14j sur toute nouvelle entreprise
--    en plan 'starter' qui n'a pas de date de fin explicite.
--    Ne touche aucune ligne existante (BEFORE INSERT uniquement).
-- ############################################################################

create or replace function public.set_essai_14j()
returns trigger
language plpgsql
as $$
begin
  if new.date_fin_abonnement is null and new.plan = 'starter' then
    new.date_fin_abonnement := now() + interval '14 days';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_essai_14j on public.entreprises;

create trigger trg_essai_14j
before insert on public.entreprises
for each row
execute function public.set_essai_14j();


-- ############################################################################
-- 2. FONCTION PIVOT
--    Dit si une entreprise a encore le droit d'écrire.
--
--    coalesce(..., true) est volontaire : une entreprise SANS date de fin
--    n'est jamais bloquée. Les clients historiques ne basculent pas en
--    lecture seule à cause de ce déploiement.
--
--    SECURITY DEFINER ici est nécessaire : la fonction doit lire
--    public.entreprises en contournant la RLS du client appelant.
-- ############################################################################

create or replace function public.entreprise_ecriture_ouverte(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.date_fin_abonnement > now(), true) and e.actif
  from public.entreprises e
  where e.id = eid
$$;

revoke execute on function public.entreprise_ecriture_ouverte(uuid) from anon;
grant  execute on function public.entreprise_ecriture_ouverte(uuid) to authenticated;


-- ############################################################################
-- 3. FONCTION DE BLOCAGE
--
--    ⚠️ PAS de SECURITY DEFINER ici, et c'est le point critique.
--    En SECURITY DEFINER, current_user vaut le PROPRIÉTAIRE de la fonction
--    (postgres) et non l'appelant réel : l'exemption back-office ci-dessous
--    s'appliquerait alors à tout le monde et le trigger ne bloquerait
--    jamais personne. Bug constaté en test le 15/09/2026, puis corrigé.
--    Ne pas rajouter security definer sur cette fonction.
-- ############################################################################

create or replace function public.bloque_si_essai_termine()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  eid uuid;
begin
  -- back-office et Edge Functions : jamais bloqués
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  eid := case when tg_op = 'DELETE' then old.entreprise_id else new.entreprise_id end;

  if eid is not null and not public.entreprise_ecriture_ouverte(eid) then
    raise exception 'ESSAI_TERMINE'
      using detail = 'Periode d''essai terminee : compte en lecture seule.',
            hint   = 'Contactez Velor Telecom pour activer votre abonnement.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- ############################################################################
-- 4. POSE DES TRIGGERS — 19 tables de données métier
--
--    32 tables portent entreprise_id. 13 sont volontairement EXCLUES :
--
--      abonnements, entreprise_modules       levier de sortie de la lecture
--                                            seule — les geler verrouille
--                                            la porte de l'intérieur
--      audit_events, business_events         la journalisation doit continuer
--      notifications                         pour prévenir le client
--      credentials_temporaires               réinitialisation de mot de passe
--      super_admin_assistance_sessions       outil d'assistance Velor
--      profiles                              si la connexion y écrit, geler
--                                            = plus personne ne se connecte
--      conversations, conversation_participants,
--      messages, ticket_messages             le canal par lequel le client
--                                            expiré demande à payer
--      pointages                             décision du 15/09/2026 : un
--                                            employé en poste doit pouvoir
--                                            pointer sa sortie même après
--                                            expiration
-- ############################################################################

do $$
declare
  t text;
  cibles text[] := array[
    'chambres','conges','corrections_pointage','departements',
    'employe_departements','employe_equipes','employe_sites',
    'entreprise_parametres_pointage','equipes','feed_items','handovers',
    'maintenance_tickets','postes','rappels','shift_events','shifts',
    'sites','soldes_conges','taches'
  ];
begin
  foreach t in array cibles loop
    execute format('drop trigger if exists trg_lecture_seule on public.%I', t);
    execute format(
      'create trigger trg_lecture_seule before insert or update or delete '
      'on public.%I for each row execute function public.bloque_si_essai_termine()', t);
  end loop;
end $$;


-- ############################################################################
-- 5. CONTRÔLE
-- ############################################################################

-- attendu : 19
select count(*) as triggers_lecture_seule
from pg_trigger tg
join pg_class     c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and tg.tgname = 'trg_lecture_seule'
  and not tg.tgisinternal;


-- ############################################################################
-- ROLLBACK COMPLET
-- ############################################################################
-- do $$
-- declare t text;
-- begin
--   for t in select c.relname from pg_trigger tg
--            join pg_class c on c.oid = tg.tgrelid
--            join pg_namespace n on n.oid = c.relnamespace
--            where n.nspname = 'public' and tg.tgname = 'trg_lecture_seule'
--              and not tg.tgisinternal
--   loop
--     execute format('drop trigger if exists trg_lecture_seule on public.%I', t);
--   end loop;
-- end $$;
--
-- drop function if exists public.bloque_si_essai_termine();
-- drop function if exists public.entreprise_ecriture_ouverte(uuid);
-- drop trigger  if exists trg_essai_14j on public.entreprises;
-- drop function if exists public.set_essai_14j();


-- ############################################################################
-- SUIVI DES ESSAIS — la requête derrière l'onglet Demandes
-- ############################################################################
-- select e.nom, e.telephone, e.email_contact, e.plan,
--        e.date_fin_abonnement,
--        (e.date_fin_abonnement::date - now()::date) as jours_restants,
--        case when e.date_fin_abonnement is null then 'pas d''essai'
--             when e.date_fin_abonnement > now() then 'essai en cours'
--             else 'essai termine' end as statut
-- from public.entreprises e
-- order by e.date_fin_abonnement nulls last;
