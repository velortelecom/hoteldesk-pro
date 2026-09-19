-- =====================================================================
-- LA TRACE DES ENTREES ET DES SORTIES
--
-- POURQUOI, ET POURQUOI MAINTENANT
--   Facturer au prorata suppose de savoir COMBIEN d'utilisateurs etaient
--   actifs CHAQUE JOUR de la periode. Aujourd'hui la base ne sait
--   repondre qu'a « combien maintenant » : desactiver quelqu'un met
--   actif a false et n'ecrit la date nulle part. date_entree existe mais
--   n'est renseignee pour personne.
--
--   Un prorata code sans cette trace facturerait tout le monde au mois
--   plein et aurait l'air juste. C'est la pire forme de faux.
--
--   Et c'est urgent independamment du calcul : chaque jour sans trace
--   est un jour d'historique perdu pour toujours. Le calcul, lui, peut
--   attendre demain.
--
-- POURQUOI UNE TRACE D'EVENEMENTS, PAS DEUX COLONNES
--   Deux colonnes (entre_le / sorti_le) ne savent pas raconter un
--   aller-retour : un saisonnier desactive en novembre et repris en
--   avril ecraserait sa propre histoire. Une suite d'evenements dit la
--   verite dans tous les cas, y compris ceux qu'on n'a pas prevus.
--
-- POURQUOI DES DECLENCHEURS, PAS DES APPELS DEPUIS L'APPLICATION
--   Une trace qu'il faut penser a ecrire est une trace qui manquera le
--   jour ou quelqu'un desactive un compte depuis l'editeur Supabase, ou
--   depuis un ecran qu'on ajoutera plus tard. Le declencheur est sur la
--   TABLE : quel que soit le chemin, le mouvement est enregistre.
--
-- POURQUOI AUCUNE CLE ETRANGERE VERS profiles
--   Un compte supprime ne doit pas effacer le fait qu'il a ete facture
--   en septembre. Une cle etrangere en CASCADE detruirait exactement la
--   preuve dont on a besoin. On garde donc l'identifiant sans contrainte,
--   volontairement.
-- =====================================================================

begin;

create table if not exists public.mouvements_utilisateur (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null,
  profile_id     uuid not null,
  mouvement      text not null check (mouvement in ('entree', 'sortie')),
  survenu_le     timestamptz not null default now(),
  -- D'ou vient la ligne : 'declencheur' = observe en direct ;
  -- 'reprise' = deduit de l'historique au moment de cette migration.
  -- Les deux ne se valent pas, et le calcul doit pouvoir le dire.
  origine        text not null default 'declencheur'
                 check (origine in ('declencheur', 'reprise', 'manuel')),
  cree_le        timestamptz not null default now()
);

create index if not exists mouvements_utilisateur_entreprise_date_idx
  on public.mouvements_utilisateur (entreprise_id, survenu_le);

create index if not exists mouvements_utilisateur_profil_idx
  on public.mouvements_utilisateur (profile_id, survenu_le);

comment on table public.mouvements_utilisateur is
  'Entrees et sorties d''utilisateurs, pour la facturation au prorata. '
  'Alimentee par declencheur sur profiles : aucun ecran n''a a y penser.';

-- ---------------------------------------------------------------------
-- LE DECLENCHEUR
--
-- SECURITY DEFINER : l'insertion doit reussir quel que soit l'appelant.
-- Un admin qui desactive un employe n'a aucun droit d'ecriture sur cette
-- table, et c'est tres bien -- mais son geste doit quand meme laisser
-- une trace.
--
-- Le super admin est exclu : il n'est jamais facture (voir
-- utilisateurs_factures), donc ses mouvements ne serviraient qu'a
-- brouiller le compte.
-- ---------------------------------------------------------------------
create or replace function public.tracer_mouvement_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mouvement text;
begin
  if coalesce(new.is_super_admin, false) then
    return new;
  end if;
  if new.entreprise_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Un compte cree inactif n'est pas une entree : il n'est pas facture.
    if coalesce(new.actif, true) = false then
      return new;
    end if;
    v_mouvement := 'entree';

  else
    -- Seul un CHANGEMENT de actif compte. Renommer quelqu'un ne le fait
    -- ni entrer ni sortir, et ecrire un mouvement a chaque UPDATE
    -- remplirait la table de bruit qu'il faudrait ensuite demeler.
    if coalesce(old.actif, true) = coalesce(new.actif, true) then
      return new;
    end if;
    v_mouvement := case when coalesce(new.actif, true) then 'entree' else 'sortie' end;
  end if;

  insert into public.mouvements_utilisateur (entreprise_id, profile_id, mouvement, origine)
  values (new.entreprise_id, new.id, v_mouvement, 'declencheur');

  return new;
end $$;

drop trigger if exists tracer_mouvement_utilisateur_ins on public.profiles;
create trigger tracer_mouvement_utilisateur_ins
  after insert on public.profiles
  for each row execute function public.tracer_mouvement_utilisateur();

drop trigger if exists tracer_mouvement_utilisateur_upd on public.profiles;
create trigger tracer_mouvement_utilisateur_upd
  after update of actif on public.profiles
  for each row execute function public.tracer_mouvement_utilisateur();

-- ---------------------------------------------------------------------
-- REPRISE DE L'EXISTANT
--
-- Pour les comptes deja en place, on pose une entree a leur date de
-- creation. Ce n'est pas une invention : le compte existe bel et bien
-- depuis cette date. Mais ce n'est pas non plus une observation, d'ou
-- origine = 'reprise'.
--
-- UN COMPTE DEJA INACTIF NE RECOIT RIEN DU TOUT.
--
--   C'est le piege que la premiere version de cette migration n'avait
--   pas vu. Lui poser une « entree » a sa creation sans sortie -- parce
--   que personne ne sait quand il est parti -- le ferait compter comme
--   present pour toujours. On facturerait indefiniment quelqu'un qui
--   n'est plus la, et le fichier aurait l'air juste.
--
--   Il n'est pas facturable aujourd'hui, et son passe est inconnu :
--   alors on n'ecrit rien. S'il est reactive un jour, le declencheur
--   posera son entree a ce moment-la, avec la bonne date.
--
--   Meme principe que partout dans ce projet : quand on ne sait pas, on
--   ne devine pas. Une journee de pointage incomplete ne vaut pas zero
--   heure ; un depart de date inconnue ne vaut pas une presence.
-- ---------------------------------------------------------------------
do $$
declare v_reprises integer;
begin
  insert into public.mouvements_utilisateur
    (entreprise_id, profile_id, mouvement, survenu_le, origine)
  select p.entreprise_id, p.id, 'entree', coalesce(p.created_at, now()), 'reprise'
  from public.profiles p
  where p.entreprise_id is not null
    and coalesce(p.is_super_admin, false) = false
    and coalesce(p.actif, true) = true
    and not exists (
      select 1 from public.mouvements_utilisateur m
      where m.profile_id = p.id
    );

  get diagnostics v_reprises = row_count;
  raise notice 'Comptes actifs repris avec leur date de creation : %', v_reprises;
end $$;

-- ---------------------------------------------------------------------
-- QUI PEUT LIRE
--
-- Aucune politique d'ecriture : cette table ne se remplit que par le
-- declencheur. Personne ne corrige l'histoire a la main depuis
-- l'application -- c'est ce qui en fait une preuve.
-- ---------------------------------------------------------------------
alter table public.mouvements_utilisateur enable row level security;

drop policy if exists mouvements_utilisateur_select on public.mouvements_utilisateur;
create policy mouvements_utilisateur_select on public.mouvements_utilisateur
  for select
  using (
    is_super_admin()
    or (entreprise_id = get_my_entreprise_id() and get_my_role() = 'admin'::text)
  );

commit;

-- =====================================================================
-- CONTROLE -- lire ces lignes, pas le mot « Success ».
-- =====================================================================
select 'Mouvements enregistres'        as controle,
       count(*)::text                  as valeur,
       'au moins un par compte actif'  as attendu
from public.mouvements_utilisateur
union all
select 'Dont observes en direct',
       count(*) filter (where origine = 'declencheur')::text,
       '0 au premier passage, puis augmente'
from public.mouvements_utilisateur
union all
select 'Dont repris a la creation',
       count(*) filter (where origine = 'reprise')::text,
       'le nombre de comptes deja en place'
from public.mouvements_utilisateur
union all
select 'Comptes ACTIFS sans aucune trace',
       count(*)::text,
       'doit valoir 0'
from public.profiles p
where p.entreprise_id is not null
  and coalesce(p.is_super_admin, false) = false
  and coalesce(p.actif, true) = true
  and not exists (select 1 from public.mouvements_utilisateur m where m.profile_id = p.id)
union all
-- Une entree sans sortie sur un compte inactif = quelqu'un qu'on
-- facturerait a vie. C'est le defaut que la premiere version de cette
-- migration produisait ; ce controle existe pour qu'il ne revienne pas.
select 'Inactifs comptes comme presents',
       count(*)::text,
       'doit valoir 0'
from public.profiles p
where coalesce(p.actif, true) = false
  and (
    select count(*) filter (where m.mouvement = 'entree')
         - count(*) filter (where m.mouvement = 'sortie')
    from public.mouvements_utilisateur m
    where m.profile_id = p.id
  ) > 0;
