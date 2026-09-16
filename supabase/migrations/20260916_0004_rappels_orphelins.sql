-- ============================================================================
-- VELOR ONE / HÔTELDESK PRO
-- Rappels fantômes : la cause, puis le nettoyage
--
-- CE QUI SE PASSAIT
--   Modifier une tâche récurrente déclenche generer_occurrences_recurrentes,
--   qui supprime les occurrences filles puis les recrée. Or la clé étrangère
--   rappels.tache_id est en ON DELETE SET NULL : les rappels des filles
--   supprimées survivent, détachés, et restent affichés. La nouvelle
--   génération en crée d'autres. Deux modifications = deux séries visibles.
--
--   Constaté en production : 14 rappels sans tâche sur 29, dont 13 générés
--   par le trigger, créés par paires à 13:57:06 et 13:58:10.
--
-- CE QUE FAIT CE SCRIPT
--   1. sauvegarde les fantômes avant de les toucher
--   2. vérifie qu'aucun rappel manuel n'est dans le lot
--   3. supprime les fantômes
--   4. passe la clé étrangère en CASCADE : plus aucun orphelin à l'avenir
--   5. corrige le fuseau de gerer_rappels_tache
--
-- À coller EN ENTIER dans le SQL Editor Supabase.
-- Tout est dans une transaction : au moindre écart, rien n'est modifié.
-- ============================================================================

begin;

-- ############################################################################
-- 1. SAUVEGARDE
--
-- Les rappels créés à la main n'ont PAS de tache_id non plus : la page
-- Rappels ne le renseigne jamais. « tache_id vide » ne suffit donc pas à
-- désigner un fantôme, il faut aussi le titre fabriqué par le trigger.
-- ############################################################################

create table if not exists public.zz_rappels_orphelins_supprimes (
  id           uuid primary key,
  titre        text,
  description  text,
  date_rappel  timestamptz,
  cree_par     uuid,
  assigne_a    uuid,
  created_at   timestamptz,
  supprime_le  timestamptz not null default now()
);

insert into public.zz_rappels_orphelins_supprimes
  (id, titre, description, date_rappel, cree_par, assigne_a, created_at)
select r.id, r.titre, r.description, r.date_rappel, r.cree_par, r.assigne_a, r.created_at
from public.rappels r
where r.tache_id is null
  and (r.titre like 'Rappel : %' or r.titre like 'RETARD : %' or r.titre like 'Tâche en attente : %')
on conflict (id) do nothing;


-- ############################################################################
-- 2. CONTRÔLES AVANT SUPPRESSION
-- ############################################################################

do $$
declare
  v_fantomes integer;
  v_manuels  integer;
begin
  select count(*) into v_fantomes
  from public.rappels
  where tache_id is null
    and (titre like 'Rappel : %' or titre like 'RETARD : %' or titre like 'Tâche en attente : %');

  select count(*) into v_manuels
  from public.rappels
  where tache_id is null
    and not (titre like 'Rappel : %' or titre like 'RETARD : %' or titre like 'Tâche en attente : %');

  if v_fantomes <> 13 then
    raise exception 'STOP : % fantomes trouves, 13 attendus. Rien supprime.', v_fantomes;
  end if;

  raise notice 'Controles OK : % fantomes a supprimer, % rappels manuels conserves.', v_fantomes, v_manuels;
end
$$;


-- ############################################################################
-- 3. SUPPRESSION
-- ############################################################################

delete from public.rappels r
where r.id in (select id from public.zz_rappels_orphelins_supprimes);


-- ############################################################################
-- 4. LA CAUSE : la clé étrangère passe en CASCADE
--
-- Un rappel n'a aucune raison de survivre à la tâche qui l'a produit.
-- On retrouve la contrainte par son rôle plutôt que par son nom, qui peut
-- différer d'un environnement à l'autre.
-- ############################################################################

do $$
declare
  v_nom text;
begin
  select con.conname into v_nom
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  join pg_namespace n on n.oid = src.relnamespace
  where con.contype = 'f'
    and n.nspname = 'public'
    and src.relname = 'rappels'
    and tgt.relname = 'taches';

  if v_nom is null then
    raise exception 'STOP : cle etrangere rappels -> taches introuvable. Rien modifie.';
  end if;

  execute format('alter table public.rappels drop constraint %I', v_nom);
  execute format(
    'alter table public.rappels add constraint %I foreign key (tache_id) references public.taches(id) on delete cascade',
    v_nom
  );

  raise notice 'Cle etrangere % repassee en ON DELETE CASCADE.', v_nom;
end
$$;


-- ############################################################################
-- 5. LE FUSEAU
--
-- La fonction composait sa description avec AT TIME ZONE 'UTC' : le texte
-- annonçait « à 00h » sous un horodatage affiché à 02:00 en heure de Paris.
-- Depuis que les échéances sont enregistrées en heure locale côté client,
-- cette description afficherait carrément le mauvais jour.
--
-- Seules les deux lignes TO_CHAR changent. Tout le reste est le corps
-- existant, reproduit à l'identique.
-- ############################################################################

CREATE OR REPLACE FUNCTION public.gerer_rappels_tache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_responsable uuid;
  v_titre_rappel text;
  v_priorite text;
  v_date_rappel timestamptz;
  v_description text;
BEGIN
  -- Si la tâche est terminée: marquer tous ses rappels comme lus
  IF NEW.statut = 'terminee' THEN
    UPDATE public.rappels SET notifie = true
    WHERE tache_id = NEW.id AND notifie = false;
    RETURN NEW;
  END IF;

  -- Déterminer le responsable du rappel
  v_responsable := COALESCE(NEW.assigne_a, NEW.cree_par);

  -- Mapper la priorité tâche -> rappel (urgente/normale/basse)
  v_priorite := CASE NEW.priorite
    WHEN 'haute' THEN 'urgente'
    WHEN 'urgente' THEN 'urgente'
    WHEN 'moyenne' THEN 'normale'
    WHEN 'basse' THEN 'basse'
    ELSE 'normale'
  END;

  -- CAS 1: Tâche avec date d'échéance DÉPASSÉE (en retard)
  IF NEW.date_echeance IS NOT NULL AND NEW.date_echeance < NOW() THEN
    v_titre_rappel := 'RETARD : ' || NEW.titre;
    v_priorite := 'urgente';
    v_date_rappel := NOW();
    v_description := 'Tâche en retard ! Échéance était le ' || TO_CHAR(NEW.date_echeance AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY à HH24h') || '. Statut actuel : ' || NEW.statut;

  -- CAS 2: Tâche avec date d'échéance FUTURE → rappel le jour J
  ELSIF NEW.date_echeance IS NOT NULL AND NEW.date_echeance >= NOW() THEN
    v_titre_rappel := 'Rappel : ' || NEW.titre;
    v_date_rappel := NEW.date_echeance;
    v_description := 'Tâche à compléter avant le ' || TO_CHAR(NEW.date_echeance AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY à HH24h');

  -- CAS 3: Tâche sans date d'échéance, non commencée → rappel dans 24h
  ELSIF NEW.date_echeance IS NULL AND NEW.statut IN ('planifiee', 'en_cours') THEN
    v_titre_rappel := 'Tâche en attente : ' || NEW.titre;
    v_priorite := 'normale';
    v_date_rappel := COALESCE(NEW.created_at, NOW()) + INTERVAL '24 hours';
    v_description := 'Tâche sans échéance définie. Pensez à la compléter.';
  ELSE
    RETURN NEW;
  END IF;

  -- Supprimer l'ancien rappel non lu pour éviter les doublons
  DELETE FROM public.rappels
  WHERE tache_id = NEW.id AND notifie = false;

  -- Créer le nouveau rappel uniquement si on a un responsable
  IF v_responsable IS NOT NULL THEN
    INSERT INTO public.rappels (titre, description, priorite, date_rappel, cree_par, assigne_a, tache_id, notifie)
    VALUES (v_titre_rappel, v_description, v_priorite, v_date_rappel,
            COALESCE(NEW.cree_par, v_responsable), v_responsable, NEW.id, false);
  END IF;

  RETURN NEW;
END;
$function$;


-- ############################################################################
-- 6. CONTRÔLE FINAL
-- ############################################################################

do $$
declare
  v_restants integer;
  v_manuels  integer;
  v_action   char;
begin
  select count(*) into v_restants
  from public.rappels
  where tache_id is null
    and (titre like 'Rappel : %' or titre like 'RETARD : %' or titre like 'Tâche en attente : %');

  select count(*) into v_manuels
  from public.rappels
  where tache_id is null
    and not (titre like 'Rappel : %' or titre like 'RETARD : %' or titre like 'Tâche en attente : %');

  select con.confdeltype into v_action
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  where con.contype = 'f' and src.relname = 'rappels' and tgt.relname = 'taches';

  if v_restants <> 0 then
    raise exception 'STOP : % fantomes survivent. Tout est annule.', v_restants;
  end if;
  if v_manuels < 1 then
    raise exception 'STOP : plus aucun rappel manuel. Tout est annule.';
  end if;
  if v_action <> 'c' then
    raise exception 'STOP : la cle etrangere n''est pas en CASCADE. Tout est annule.';
  end if;

  raise notice 'OK : 0 fantome, % rappel(s) manuel(s) conserve(s), cle en CASCADE.', v_manuels;
end
$$;

commit;


-- ############################################################################
-- 7. APRÈS COUP — à jouer séparément
-- ############################################################################

select 'rappels restants' as controle, count(*)::text as valeur from public.rappels
union all
select 'dont sans tache (manuels)', count(*)::text from public.rappels where tache_id is null
union all
select 'fantomes archives', count(*)::text from public.zz_rappels_orphelins_supprimes;
