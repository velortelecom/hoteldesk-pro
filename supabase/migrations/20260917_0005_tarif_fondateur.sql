-- =====================================================================
-- 20260917_0005 : TARIF FONDATEUR
--
-- Les PREMIERES entreprises inscrites entrent a 29 EUR et gardent ce prix
-- A VIE. Au-dela, le tarif public est 39 EUR.
--
-- POURQUOI CE TARIF EXISTE
--   Ce n'est pas une promotion. C'est ce qui rend honnete de vendre
--   aujourd'hui un produit dont le pointage n'est pas termine : ces
--   entreprises prennent un risque, elles gardent le prix.
--
-- POURQUOI UN TRIGGER ET PAS UNE MODIFICATION DE LA RPC
--   La RPC public_signup_create_entreprise_atomic fait 400 lignes. La
--   reecrire entierement pour changer trois constantes, c'est prendre le
--   risque de casser l'inscription pour un calcul de prix. Un trigger
--   BEFORE INSERT fait le travail sans toucher a la RPC -- exactement le
--   schema deja utilise par set_essai_14j.
--
-- POURQUOI "A VIE" NE DEMANDE AUCUN MECANISME
--   Le prix est fige dans entreprises.prix_mensuel a la creation, et
--   l'application lit TOUJOURS cette colonne en priorite sur la grille.
--   Changer le tarif public demain ne touchera donc aucune entreprise
--   existante. Il n'y a rien a maintenir.
--
-- PORTEE VOLONTAIREMENT ETROITE
--   Le trigger n'agit QUE sur les inscriptions publiques
--   (origine = 'inscription_autonome') et QUE sur le plan 'starter'. Une
--   entreprise creee a la main par le Super Admin garde le prix qu'il lui
--   a donne : ce n'est pas au code de decider a sa place.
--
-- Entierement idempotent : rejouable sans effet de bord.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. La marque de fondateur
--
--    On ne se contente PAS de reconnaitre un fondateur a son prix de
--    29 EUR : le Super Admin pourrait accorder ce montant a n'importe qui,
--    et le comptage des dix premieres places deviendrait faux.
-- ---------------------------------------------------------------------
alter table public.entreprises
  add column if not exists tarif_fondateur boolean not null default false;

comment on column public.entreprises.tarif_fondateur is
  'Entreprise entree parmi les premieres : garde son prix mensuel a vie.';

-- Index partiel : le trigger ne compte que les lignes a true, et elles
-- sont au plus dix.
create index if not exists idx_entreprises_tarif_fondateur
  on public.entreprises (tarif_fondateur)
  where tarif_fondateur = true;

-- ---------------------------------------------------------------------
-- 2. L'attribution du tarif
-- ---------------------------------------------------------------------
create or replace function public.appliquer_tarif_fondateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tarif_fondateur constant numeric := 29;
  c_prix_standard   constant numeric := 39;
  c_fondateurs_max  constant integer := 5;
  v_nb_fondateurs   integer;
begin
  -- Seules les inscriptions publiques sur l'offre Velor One sont
  -- concernees. Tout le reste passe sans etre touche.
  if coalesce(new.origine, '') <> 'inscription_autonome' then
    return new;
  end if;
  if new.plan is distinct from 'starter' then
    return new;
  end if;

  -- Verrou le temps de la transaction : sans lui, deux inscriptions
  -- simultanees pourraient toutes deux se croire dixiemes et creer une
  -- onzieme place. Improbable au volume actuel, mais un compteur de
  -- places limitees sans verrou est un bug qui attend son heure.
  perform pg_advisory_xact_lock(hashtext('tarif_fondateur'));

  select count(*) into v_nb_fondateurs
  from public.entreprises e
  where e.tarif_fondateur = true;

  if v_nb_fondateurs < c_fondateurs_max then
    new.tarif_fondateur := true;
    new.prix_mensuel    := c_tarif_fondateur;
  else
    new.tarif_fondateur := false;
    new.prix_mensuel    := c_prix_standard;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tarif_fondateur on public.entreprises;

-- AVANT le trigger d'essai 14 jours dans l'ordre alphabetique des noms :
-- les deux sont BEFORE INSERT et independants, mais autant que l'ordre
-- soit previsible.
create trigger trg_tarif_fondateur
before insert on public.entreprises
for each row
execute function public.appliquer_tarif_fondateur();

-- ---------------------------------------------------------------------
-- 3. Combien de places restent -- lisible SANS ETRE CONNECTE.
--
--    L'ecran d'inscription affichait le tarif public (39 EUR) alors que
--    le trigger allait facturer 29 EUR a un fondateur : un ecran qui ment,
--    exactement ce qu'on passe la semaine a corriger ailleurs. Il lui faut
--    donc une facon de connaitre le nombre de places, avant tout compte.
--
--    La fonction ne rend qu'un entier. Elle n'expose ni nom d'entreprise,
--    ni volume d'affaires : savoir qu'il reste deux places ne renseigne
--    sur personne.
-- ---------------------------------------------------------------------
create or replace function public.places_fondateur_restantes()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, 5 - (select count(*)::integer from public.entreprises where tarif_fondateur))
$$;

revoke all on function public.places_fondateur_restantes() from public;
grant execute on function public.places_fondateur_restantes() to anon, authenticated;

commit;

-- ---------------------------------------------------------------------
-- 4. Verification : l'etat reel apres application.
-- ---------------------------------------------------------------------
select
  (select count(*) from public.entreprises where tarif_fondateur) as fondateurs_actuels,
  public.places_fondateur_restantes()                             as places_restantes,
  (select count(*) from pg_trigger
     where tgrelid = 'public.entreprises'::regclass
       and tgname = 'trg_tarif_fondateur')                        as trigger_en_place;
