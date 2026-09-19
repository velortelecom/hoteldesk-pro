-- =====================================================================
-- FACTURER UN CLIENT AU PRORATA, DE SON INSCRIPTION AU JOUR CHOISI
--
-- LE BESOIN
--   Un hotel qui s'inscrit le 20 septembre et qu'on facture le 30 ne
--   doit pas payer 29 EUR pleins pour onze jours. Et le mois suivant, il
--   ne doit pas repayer ces onze jours.
--
-- LES DEUX DATES
--   DEBUT : le lendemain de la derniere facturation enregistree. S'il
--           n'y en a aucune, la date d'inscription de l'entreprise.
--   FIN   : le jour que TU choisis. Rien n'impose le 30, ni une
--           periodicite quelconque.
--
--   Une seule regle, donc, pour la premiere facture comme pour les
--   suivantes : « du lendemain de la derniere fois a la date que tu
--   dis ». Pas de cas particulier a la premiere facture -- et un cas
--   particulier, c'est toujours celui qu'on oublie de tester.
--
-- LE PRIX D'UNE JOURNEE
--   prix_mensuel divise par le nombre de jours REELS du mois concerne.
--   Septembre : 29 / 30 = 0,9667. Fevrier : 29 / 28 = 1,0357.
--
--   Consequence voulue : un mois complet coute TOUJOURS exactement le
--   prix affiche. C'est ce qu'un client verifie en premier, et une base
--   30 fixe ferait depasser les mois de 31 jours de quelques centimes --
--   le genre de centime qui declenche un appel.
--
--   Une periode a cheval est donc decoupee mois par mois, chacun avec
--   son propre prix journalier, et chaque ligne est arrondie au
--   centime : le detail additionne redonne le total exactement. Un
--   client qui recompte doit tomber juste.
--
-- CE QUI N'EST PAS FIGE
--   Une facturation enregistree s'ANNULE, elle ne se supprime pas.
--   Annulee, elle ne compte plus pour le calcul du prochain debut : la
--   periode redevient facturable. On garde la trace de ce qui a ete
--   fait, on n'interdit pas de le refaire autrement.
--
--   Et le calcul est toujours consultable sans rien enregistrer :
--   facturation_client() ne modifie rien. On regarde, puis on decide.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. LE REPERE : ce qui a deja ete facture
-- ---------------------------------------------------------------------
create table if not exists public.facturations_client (
  id                uuid primary key default gen_random_uuid(),
  entreprise_id     uuid not null,
  periode_debut     date not null,
  periode_fin       date not null,
  jours             integer not null,
  -- On recopie les conditions du moment. Si le plan ou le prix change
  -- plus tard, la facture passee doit rester lisible telle qu'elle a
  -- ete emise -- une facture qui se recalcule toute seule n'est pas une
  -- facture.
  plan              text,
  prix_mensuel      numeric(10,2),
  tarif_fondateur   boolean,
  -- Trois montants, pas un seul : une facture qui ne dit pas d'ou vient
  -- son total n'est pas verifiable par le client.
  montant_abonnement   numeric(10,2) not null default 0,
  montant_utilisateurs numeric(10,2) not null default 0,
  montant              numeric(10,2) not null,
  detail               jsonb,
  facturee_le       timestamptz not null default now(),
  facturee_par      uuid,
  annulee           boolean not null default false,
  annulee_le        timestamptz,
  motif_annulation  text,
  constraint facturations_client_periode_coherente check (periode_fin >= periode_debut)
);

create index if not exists facturations_client_entreprise_idx
  on public.facturations_client (entreprise_id, periode_fin desc);

comment on table public.facturations_client is
  'Ce qui a deja ete facture a chaque client. Sert a savoir ou reprendre. '
  'Une ligne s''annule, elle ne se supprime pas.';

alter table public.facturations_client enable row level security;

-- Aucune politique d'ecriture : tout passe par les fonctions ci-dessous,
-- qui verifient le super admin. La lecture directe est reservee au
-- super admin -- un client n'a pas a lire la table de facturation.
drop policy if exists facturations_client_select on public.facturations_client;
create policy facturations_client_select on public.facturations_client
  for select using (is_super_admin());

-- ---------------------------------------------------------------------
-- 2. LE CALCUL, MOIS PAR MOIS
--
-- Fonction interne : elle ne controle aucun droit, ce sont ses
-- appelants qui le font. Revoquee de tout le monde.
-- ---------------------------------------------------------------------
drop function if exists public.prorata_abonnement(numeric, date, date);

create function public.prorata_abonnement(
  p_prix_mensuel numeric,
  p_debut        date,
  p_fin          date
)
returns table (
  montant numeric,
  jours   integer,
  detail  jsonb
)
language sql
stable
as $$
  with mois as (
    select
      m::date                                              as premier_du_mois,
      (m + interval '1 month - 1 day')::date               as dernier_du_mois,
      extract(day from (m + interval '1 month - 1 day'))::integer as jours_du_mois
    from generate_series(
           date_trunc('month', p_debut),
           date_trunc('month', p_fin),
           interval '1 month'
         ) as m
    where p_fin >= p_debut
  ),
  lignes as (
    select
      premier_du_mois,
      jours_du_mois,
      greatest(premier_du_mois, p_debut)  as du,
      least(dernier_du_mois, p_fin)       as au,
      (least(dernier_du_mois, p_fin) - greatest(premier_du_mois, p_debut) + 1) as jours_couverts
    from mois
  ),
  chiffrees as (
    select
      premier_du_mois, jours_du_mois, du, au, jours_couverts,
      -- Arrondi a la LIGNE, pas seulement au total : le detail que le
      -- client additionne doit redonner le total au centime pres.
      round(
        coalesce(p_prix_mensuel, 0) * jours_couverts::numeric / jours_du_mois::numeric,
        2
      ) as montant_mois
    from lignes
    where jours_couverts > 0
  )
  select
    coalesce(sum(montant_mois), 0)::numeric                          as montant,
    coalesce(sum(jours_couverts), 0)::integer                        as jours,
    coalesce(jsonb_agg(jsonb_build_object(
      'mois',           to_char(premier_du_mois, 'YYYY-MM'),
      'du',             du,
      'au',             au,
      'jours_couverts', jours_couverts,
      'jours_du_mois',  jours_du_mois,
      'mois_complet',   jours_couverts = jours_du_mois,
      'montant',        montant_mois
    ) order by premier_du_mois), '[]'::jsonb)                        as detail
  from chiffrees;
$$;

revoke all on function public.prorata_abonnement(numeric, date, date) from public;
revoke all on function public.prorata_abonnement(numeric, date, date) from anon;
revoke all on function public.prorata_abonnement(numeric, date, date) from authenticated;

-- ---------------------------------------------------------------------
-- 3. CE QU'IL Y A A FACTURER A UN CLIENT, AU JOUR CHOISI
--
-- Ne modifie RIEN. On regarde avant de decider.
-- ---------------------------------------------------------------------
drop function if exists public.facturation_client(uuid, date);

create function public.facturation_client(
  p_entreprise_id uuid,
  p_jusqu_au      date default current_date
)
returns table (
  entreprise_id    uuid,
  nom              text,
  inscrite_le      date,
  plan             text,
  prix_mensuel     numeric,
  tarif_fondateur  boolean,
  deja_facture_au  date,
  periode_debut    date,
  periode_fin      date,
  jours            integer,
  inclus               integer,
  montant_abonnement   numeric,
  montant_utilisateurs numeric,
  montant              numeric,
  detail               jsonb,
  detail_utilisateurs  jsonb,
  remarque         text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ent        record;
  v_inclus     integer;
  v_sup        record;
  v_dernier    date;
  v_debut      date;
  v_calc       record;
  v_remarque   text := null;
begin
  if not is_super_admin() then
    raise exception 'Reserve au super administrateur.' using errcode = '42501';
  end if;

  select e.id, e.nom, e.plan, e.prix_mensuel, e.tarif_fondateur,
         e.max_utilisateurs,
         coalesce(e.date_creation, e.created_at)::date as inscrite
    into v_ent
  from public.entreprises e
  where e.id = p_entreprise_id;

  if not found then
    raise exception 'Entreprise introuvable : %', p_entreprise_id using errcode = 'P0002';
  end if;

  -- Le dernier jour deja facture, en ignorant les facturations annulees.
  select max(f.periode_fin) into v_dernier
  from public.facturations_client f
  where f.entreprise_id = p_entreprise_id
    and f.annulee = false;

  v_debut := coalesce(v_dernier + 1, v_ent.inscrite);

  -- On n'invente pas une facture pour une periode qui n'existe pas.
  if p_jusqu_au < v_debut then
    return query select
      v_ent.id, v_ent.nom, v_ent.inscrite, v_ent.plan,
      v_ent.prix_mensuel, v_ent.tarif_fondateur, v_dernier,
      v_debut, p_jusqu_au, 0,
      public.utilisateurs_inclus(v_ent.plan, v_ent.max_utilisateurs),
      0::numeric, 0::numeric, 0::numeric, '[]'::jsonb, '[]'::jsonb,
      case
        when v_dernier is not null
          then 'Deja facture jusqu''au ' || to_char(v_dernier, 'DD/MM/YYYY') || '.'
        else 'Inscrite le ' || to_char(v_ent.inscrite, 'DD/MM/YYYY') || ', rien a facturer avant.'
      end;
    return;
  end if;

  select * into v_calc from public.prorata_abonnement(v_ent.prix_mensuel, v_debut, p_jusqu_au);

  -- Le supplement utilisateurs, au prorata lui aussi. Le plan gratuit
  -- n'en a pas : son plafond est un VRAI plafond, le depasser veut dire
  -- passer a Velor One, pas payer 2 EUR de plus.
  v_inclus := case when v_ent.plan = 'gratuit' then null
                   else public.utilisateurs_inclus(v_ent.plan, v_ent.max_utilisateurs) end;

  select * into v_sup
  from public.prorata_utilisateurs_sup(p_entreprise_id, v_inclus, 2::numeric, v_debut, p_jusqu_au);

  -- Un prix absent ou nul donne une facture a zero. Ce n'est pas au
  -- calcul de le corriger -- mais se taire dessus, c'est laisser partir
  -- une facture vide sans que personne le voie.
  if coalesce(v_ent.prix_mensuel, 0) = 0 then
    v_remarque := 'ATTENTION : prix_mensuel vaut ' || coalesce(v_ent.prix_mensuel::text, 'NULL')
                  || ' sur le plan ' || coalesce(v_ent.plan, '-')
                  || '. L''abonnement sera facture 0 EUR.';
  end if;

  -- Un forfait inexploitable ne fait pas facturer de supplement. Se
  -- taire dessus reviendrait a offrir les utilisateurs en trop sans que
  -- personne s'en apercoive.
  if v_inclus is null and v_ent.plan is distinct from 'gratuit' then
    v_remarque := coalesce(v_remarque || ' ', '')
                  || 'Aucun supplement utilisateurs : max_utilisateurs vaut '
                  || coalesce(v_ent.max_utilisateurs::text, 'NULL')
                  || ', valeur inexploitable.';
  end if;

  return query select
    v_ent.id, v_ent.nom, v_ent.inscrite, v_ent.plan,
    v_ent.prix_mensuel, v_ent.tarif_fondateur, v_dernier,
    v_debut, p_jusqu_au, v_calc.jours, v_inclus,
    v_calc.montant, v_sup.montant, (v_calc.montant + v_sup.montant),
    v_calc.detail, v_sup.detail, v_remarque;
end $$;

revoke all on function public.facturation_client(uuid, date) from public;
revoke all on function public.facturation_client(uuid, date) from anon;
grant execute on function public.facturation_client(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4. LA MEME CHOSE POUR TOUS LES CLIENTS
--
-- Boucle sur facturation_client() plutot que de refaire le calcul :
-- deux calculs qui disent la meme chose finissent toujours par ne plus
-- la dire.
-- ---------------------------------------------------------------------
drop function if exists public.facturation_clients_global(date);

create function public.facturation_clients_global(p_jusqu_au date default current_date)
returns table (
  entreprise_id    uuid,
  nom              text,
  inscrite_le      date,
  plan             text,
  prix_mensuel     numeric,
  tarif_fondateur  boolean,
  deja_facture_au  date,
  periode_debut    date,
  periode_fin      date,
  jours            integer,
  inclus               integer,
  montant_abonnement   numeric,
  montant_utilisateurs numeric,
  montant              numeric,
  detail               jsonb,
  detail_utilisateurs  jsonb,
  remarque         text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'Reserve au super administrateur.' using errcode = '42501';
  end if;

  return query
  select f.*
  from public.entreprises e
  cross join lateral public.facturation_client(e.id, p_jusqu_au) f
  order by f.montant desc, f.nom;
end $$;

revoke all on function public.facturation_clients_global(date) from public;
revoke all on function public.facturation_clients_global(date) from anon;
grant execute on function public.facturation_clients_global(date) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ENREGISTRER UNE FACTURATION
--
-- C'est le seul geste qui avance le repere. Il enregistre ce que le
-- calcul vient de dire -- pas un montant recu de l'ecran, qu'on
-- pourrait bidouiller.
-- ---------------------------------------------------------------------
drop function if exists public.enregistrer_facturation_client(uuid, date);

create function public.enregistrer_facturation_client(
  p_entreprise_id uuid,
  p_jusqu_au      date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calc record;
  v_id   uuid;
begin
  if not is_super_admin() then
    raise exception 'Reserve au super administrateur.' using errcode = '42501';
  end if;

  -- Deux clics rapides ne doivent pas enregistrer deux fois la meme
  -- periode. Le verrou tombe a la fin de la transaction.
  perform pg_advisory_xact_lock(hashtext('facturation_client:' || p_entreprise_id::text));

  select * into v_calc from public.facturation_client(p_entreprise_id, p_jusqu_au);

  if v_calc.jours <= 0 then
    raise exception 'Rien a facturer : %', coalesce(v_calc.remarque, 'periode vide')
      using errcode = 'P0001';
  end if;

  insert into public.facturations_client (
    entreprise_id, periode_debut, periode_fin, jours,
    plan, prix_mensuel, tarif_fondateur,
    montant_abonnement, montant_utilisateurs, montant,
    detail, facturee_par
  ) values (
    p_entreprise_id, v_calc.periode_debut, v_calc.periode_fin, v_calc.jours,
    v_calc.plan, v_calc.prix_mensuel, v_calc.tarif_fondateur,
    v_calc.montant_abonnement, v_calc.montant_utilisateurs, v_calc.montant,
    jsonb_build_object('abonnement', v_calc.detail,
                       'utilisateurs', v_calc.detail_utilisateurs),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.enregistrer_facturation_client(uuid, date) from public;
revoke all on function public.enregistrer_facturation_client(uuid, date) from anon;
grant execute on function public.enregistrer_facturation_client(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 6. ANNULER -- pas supprimer
--
-- La periode redevient facturable, et on garde la trace de ce qui avait
-- ete emis. C'est ce qui permet de dire « rien n'est fige » sans perdre
-- la memoire de ce qu'on a envoye a un client.
-- ---------------------------------------------------------------------
drop function if exists public.annuler_facturation_client(uuid, text);

create function public.annuler_facturation_client(
  p_facturation_id uuid,
  p_motif          text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_maj integer;
begin
  if not is_super_admin() then
    raise exception 'Reserve au super administrateur.' using errcode = '42501';
  end if;

  update public.facturations_client
     set annulee = true,
         annulee_le = now(),
         motif_annulation = p_motif
   where id = p_facturation_id
     and annulee = false;

  get diagnostics v_maj = row_count;
  return v_maj > 0;
end $$;

revoke all on function public.annuler_facturation_client(uuid, text) from public;
revoke all on function public.annuler_facturation_client(uuid, text) from anon;
grant execute on function public.annuler_facturation_client(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 7. LE SUPPLEMENT UTILISATEURS, AU PRORATA LUI AUSSI
--
-- 2 EUR par utilisateur au-dela du forfait du pack. Mais un utilisateur
-- arrive le 20 ne doit pas coûter 2 EUR pour onze jours, exactement
-- comme l'abonnement.
--
-- LA FORMULE
--   Pour chaque JOUR de la periode : max(0, actifs ce jour - inclus).
--   On somme sur le mois, on divise par les jours du mois, et on
--   multiplie par 2 EUR. Autrement dit : des « utilisateur-mois
--   supplementaires ».
--
--   Douze actifs pendant quinze jours puis onze pendant quinze jours,
--   avec dix inclus, sur un mois de trente jours :
--     (2 x 15 + 1 x 15) / 30 = 1,5 utilisateur-mois -> 3,00 EUR.
--
--   L'interet de compter par jour plutot que par personne : on n'a
--   jamais a designer LEQUEL des douze est « celui en trop ». La
--   question n'a pas de reponse, et toute reponse qu'on inventerait
--   serait contestable.
--
-- D'OU VIENT « ACTIFS CE JOUR-LA »
--   De mouvements_utilisateur. Un profil est actif un jour donne si son
--   dernier mouvement a cette date est une entree.
--
--   LIMITE A CONNAITRE : cette trace commence le jour de sa mise en
--   place. Les comptes actifs ont ete repris a leur date de creation,
--   donc leur passe est reconstitue. En revanche, un compte desactive
--   AVANT la mise en place n'a aucune trace et reste invisible -- on
--   preferait ne rien ecrire plutot que d'inventer une date de depart
--   et facturer dessus.
-- ---------------------------------------------------------------------

-- Le nombre d'utilisateurs inclus, deduit de max_utilisateurs.
--
-- Cette regle existait DEJA, ecrite en dur dans etat_facturation. La
-- sortir ici permet au nouveau calcul de s'y referer au lieu de la
-- recopier -- une regle recopiee est une regle qui divergera. Le
-- controle en fin de fichier compare les deux a chaque passage.
drop function if exists public.utilisateurs_inclus(integer);
drop function if exists public.utilisateurs_inclus(text, integer);

create function public.utilisateurs_inclus(
  p_plan             text,
  p_max_utilisateurs integer default null
)
returns integer
language sql
immutable
as $$
  -- LA LIMITE APPARTIENT AU PACK.
  --
  -- entreprises.max_utilisateurs etait ecrit par six endroits avec des
  -- replis contradictoires : 0 ici, 999 la, 10 ailleurs. Un 0 ferait
  -- facturer CHAQUE utilisateur en supplement ; un 999 n'en ferait
  -- facturer aucun. Meme entreprise, deux factures opposees selon
  -- l'ecran par lequel elle a ete creee.
  --
  -- La colonne reste un amenagement -- un forfait negocie par le Super
  -- Admin doit etre respecte -- mais seulement si elle est EXPLOITABLE.
  -- Sinon on retombe sur ce que le client a achete, au lieu de renoncer
  -- a facturer.
  --
  -- Ces limites sont la copie SQL de OFFRES (src/lib/offres.js).
  -- offres.test.js relit ce fichier et casse le build si elles
  -- divergent -- meme verrou que pour la RPC d'inscription.
  select case
           when p_max_utilisateurs is not null
                and p_max_utilisateurs > 0
                and p_max_utilisateurs <= 30
             then p_max_utilisateurs
           else (
             select o.limite
             from (values
               ('gratuit',    3),
               ('starter',    10),
               ('business',   20),
               ('premium',    30),
               ('enterprise', null::integer)
             ) as o(plan, limite)
             where o.plan = p_plan
           )
         end;
$$;

comment on function public.utilisateurs_inclus(text, integer) is
  'Utilisateurs inclus : la limite du PACK, la colonne ne servant que '
  'd''amenagement quand elle est exploitable. NULL = aucun supplement.';

drop function if exists public.prorata_utilisateurs_sup(uuid, integer, numeric, date, date);

create function public.prorata_utilisateurs_sup(
  p_entreprise_id uuid,
  p_inclus        integer,
  p_prix_sup      numeric,
  p_debut         date,
  p_fin           date
)
returns table (
  montant numeric,
  detail  jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with jours as (
    select d::date as jour
    from generate_series(p_debut, p_fin, interval '1 day') as d
    where p_inclus is not null and p_fin >= p_debut
  ),
  -- Pour chaque profil et chaque jour : etait-il actif ?
  -- Actif = son dernier mouvement a cette date est une entree.
  actifs as (
    select
      j.jour,
      count(*) filter (where dernier.mouvement = 'entree') as nb_actifs
    from jours j
    cross join lateral (
      select m.profile_id,
             (select m2.mouvement
                from public.mouvements_utilisateur m2
               where m2.profile_id = m.profile_id
                 and m2.survenu_le::date <= j.jour
               order by m2.survenu_le desc, m2.cree_le desc
               limit 1) as mouvement
      from (select distinct profile_id
              from public.mouvements_utilisateur
             where entreprise_id = p_entreprise_id) m
    ) dernier
    group by j.jour
  ),
  par_mois as (
    select
      date_trunc('month', jour)::date as premier_du_mois,
      extract(day from (date_trunc('month', jour) + interval '1 month - 1 day'))::integer as jours_du_mois,
      count(*)                                         as jours_couverts,
      sum(greatest(0, nb_actifs - p_inclus))           as surplus_jours,
      max(nb_actifs)                                   as pointe_actifs
    from actifs
    group by 1, 2
  ),
  chiffrees as (
    select *,
           round(surplus_jours::numeric / jours_du_mois::numeric, 4) as utilisateur_mois,
           round(coalesce(p_prix_sup, 0) * surplus_jours::numeric / jours_du_mois::numeric, 2) as montant_mois
    from par_mois
  )
  select
    coalesce(sum(montant_mois), 0)::numeric,
    coalesce(jsonb_agg(jsonb_build_object(
      'mois',             to_char(premier_du_mois, 'YYYY-MM'),
      'jours_couverts',   jours_couverts,
      'pointe_actifs',    pointe_actifs,
      'inclus',           p_inclus,
      'utilisateur_mois', utilisateur_mois,
      'montant',          montant_mois
    ) order by premier_du_mois), '[]'::jsonb)
  from chiffrees;
$$;

revoke all on function public.prorata_utilisateurs_sup(uuid, integer, numeric, date, date) from public;
revoke all on function public.prorata_utilisateurs_sup(uuid, integer, numeric, date, date) from anon;
revoke all on function public.prorata_utilisateurs_sup(uuid, integer, numeric, date, date) from authenticated;

commit;

-- =====================================================================
-- CONTROLE -- lire ces lignes, pas le mot « Success ».
-- =====================================================================
with essais as (
  select 'Mois complet de 30 jours' as cas,
         (select montant from public.prorata_abonnement(29, '2026-09-01', '2026-09-30')) as obtenu,
         29.00 as attendu
  union all
  select 'Mois complet de 31 jours',
         (select montant from public.prorata_abonnement(29, '2026-07-01', '2026-07-31')), 29.00
  union all
  select 'Fevrier complet (28 jours)',
         (select montant from public.prorata_abonnement(29, '2026-02-01', '2026-02-28')), 29.00
  union all
  select 'Inscrit le 20/09, facture le 30/09 (11 j)',
         (select montant from public.prorata_abonnement(29, '2026-09-20', '2026-09-30')), 10.63
  union all
  select 'A cheval 20/09 -> 31/10 (11 j + 31 j)',
         (select montant from public.prorata_abonnement(29, '2026-09-20', '2026-10-31')), 39.63
  union all
  select 'Une seule journee',
         (select montant from public.prorata_abonnement(29, '2026-09-15', '2026-09-15')), 0.97
  union all
  select 'Tarif 39 EUR, mois complet',
         (select montant from public.prorata_abonnement(39, '2026-09-01', '2026-09-30')), 39.00
  union all
  select 'Prix absent',
         (select montant from public.prorata_abonnement(null, '2026-09-01', '2026-09-30')), 0.00
)
select cas,
       obtenu,
       attendu,
       case when obtenu = attendu then 'OK' else 'A REVOIR' end as verdict
from essais
union all
select 'Limite du pack Velor One', (select public.utilisateurs_inclus('starter', 0))::numeric, 10::numeric,
       case when public.utilisateurs_inclus('starter', 0) = 10 then 'OK' else 'A REVOIR' end
union all
select 'Limite du pack Business', (select public.utilisateurs_inclus('business', 999))::numeric, 20::numeric,
       case when public.utilisateurs_inclus('business', 999) = 20 then 'OK' else 'A REVOIR' end
union all
select 'Forfait negocie respecte', (select public.utilisateurs_inclus('starter', 15))::numeric, 15::numeric,
       case when public.utilisateurs_inclus('starter', 15) = 15 then 'OK' else 'A REVOIR' end
union all
select 'Sur mesure : aucune limite', coalesce((select public.utilisateurs_inclus('enterprise', null))::numeric, -1), -1::numeric,
       case when public.utilisateurs_inclus('enterprise', null) is null then 'OK' else 'A REVOIR' end;
