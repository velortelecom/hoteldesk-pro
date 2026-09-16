-- ============================================================================
-- SUPPRESSION DES COMPTES SUPER ADMIN DE TEST
-- Ne conserve que senbati_mohamed@hotmail.fr
--
-- OPERATION DEFINITIVE. Les comptes Auth disparaissent, et avec eux les
-- profils (profiles.id references auth.users ON DELETE CASCADE).
--
-- Ce qui survit : les 19 lignes d'audit_events. Leur acteur_profile_id passe
-- a NULL (contrainte ON DELETE SET NULL), mais la colonne acteur_email garde
-- l'email en clair : l'historique reste lisible.
--
-- A coller EN ENTIER dans le SQL Editor Supabase, d'un seul bloc.
-- Tout est dans une transaction : au moindre controle qui echoue, rien
-- n'est supprime.
-- ============================================================================

begin;

-- ############################################################################
-- 1. TRACE DE CE QUI VA DISPARAITRE
--
-- Table permanente, pas temporaire : si tu dois un jour justifier la
-- disparition de ces comptes, la liste est conservee.
-- ############################################################################

create table if not exists public.zz_super_admins_supprimes (
  id              uuid primary key,
  email           text,
  prenom          text,
  nom             text,
  entreprise_id   uuid,
  compte_cree_le  timestamptz,
  supprime_le     timestamptz not null default now()
);

insert into public.zz_super_admins_supprimes (id, email, prenom, nom, entreprise_id, compte_cree_le)
select p.id, u.email, p.prenom, p.nom, p.entreprise_id, u.created_at
from public.profiles p
join auth.users u on u.id = p.id
where p.is_super_admin = true
  and lower(u.email) <> 'senbati_mohamed@hotmail.fr'
  and u.email like 'qa.%'
on conflict (id) do nothing;


-- ############################################################################
-- 2. CONTROLES AVANT SUPPRESSION
--
-- Le filtre 'qa.%' est un filet : meme si un super admin inconnu apparaissait
-- entre-temps, il ne serait pas touche. Le controle ci-dessous verifie que
-- ce filet ne laisse passer personne d'inattendu.
-- ############################################################################

do $$
declare
  v_cibles   integer;
  v_total    integer;
  v_garde    integer;
begin
  select count(*) into v_cibles
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_super_admin = true
    and lower(u.email) <> 'senbati_mohamed@hotmail.fr'
    and u.email like 'qa.%';

  select count(*) into v_total
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_super_admin = true
    and lower(u.email) <> 'senbati_mohamed@hotmail.fr';

  select count(*) into v_garde
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_super_admin = true
    and lower(u.email) = 'senbati_mohamed@hotmail.fr';

  if v_garde <> 1 then
    raise exception 'STOP : le compte a conserver est introuvable ou en double (%). Rien supprime.', v_garde;
  end if;

  if v_cibles <> v_total then
    raise exception 'STOP : % super admins a retirer, dont seulement % en qa.*. Un compte inattendu est apparu. Rien supprime.', v_total, v_cibles;
  end if;

  if v_cibles <> 11 then
    raise exception 'STOP : % comptes cibles, attendu 11. Rien supprime.', v_cibles;
  end if;

  raise notice 'Controles OK : % comptes de test vont etre supprimes.', v_cibles;
end
$$;


-- ############################################################################
-- 3. LA SUPPRESSION
--
-- Une seule instruction : la cascade fait le reste.
-- ############################################################################

delete from auth.users u
where u.id in (select id from public.zz_super_admins_supprimes)
  and u.email like 'qa.%'
  and lower(u.email) <> 'senbati_mohamed@hotmail.fr';


-- ############################################################################
-- 4. CONTROLE FINAL
-- ############################################################################

do $$
declare
  v_nb    integer;
  v_email text;
  v_prof  integer;
begin
  select count(*) into v_nb from public.profiles where is_super_admin = true;

  select u.email into v_email
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_super_admin = true;

  select count(*) into v_prof
  from public.profiles p
  where p.id in (select id from public.zz_super_admins_supprimes);

  if v_nb <> 1 then
    raise exception 'STOP : % super admins restants, attendu 1. Tout est annule.', v_nb;
  end if;

  if lower(v_email) <> 'senbati_mohamed@hotmail.fr' then
    raise exception 'STOP : le super admin restant est %. Tout est annule.', v_email;
  end if;

  if v_prof <> 0 then
    raise exception 'STOP : % profils survivent a la cascade. Tout est annule.', v_prof;
  end if;

  raise notice 'OK : super admin unique = %', v_email;
end
$$;

commit;


-- ############################################################################
-- 5. APRES COUP -- a jouer separement pour verifier
-- ############################################################################

-- Qui reste super admin (attendu : 1 ligne, Mohamed)
select u.email, p.prenom, p.nom, p.actif
from public.profiles p join auth.users u on u.id = p.id
where p.is_super_admin = true;

-- Ce qui a ete supprime (attendu : 11 lignes)
-- select email, compte_cree_le, supprime_le from public.zz_super_admins_supprimes order by email;

-- L'audit reste lisible malgre acteur_profile_id a NULL (attendu : 19 lignes)
-- select acteur_email, action, type_cible, created_at
-- from public.audit_events
-- where acteur_profile_id is null and acteur_email like 'qa.%'
-- order by created_at desc;
