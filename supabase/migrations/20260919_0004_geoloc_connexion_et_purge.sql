-- =====================================================================
-- GEOLOCALISATION : LE RELEVE A LA CONNEXION, ET LA PURGE A UN AN
--
-- CE QUI CHANGE
--   1. Un releve peut desormais etre justifie par une CONNEXION, et
--      plus seulement par une action metier.
--   2. Le lieu n'est plus a saisir : la position part seule, et la
--      comparaison a l'adresse du client se fait APRES, en cas de
--      contestation.
--   3. Les releves se conservent UN AN, puis se purgent.
--
-- POURQUOI 'connexion' EST UN TYPE A PART
--   Pas par scrupule d'ecriture : parce qu'un releve de connexion et un
--   releve d'action ne se defendent pas pareil. Le second dit « le
--   travail a ete fait ici ». Le premier dit seulement « l'application a
--   ete ouverte ici » -- y compris un dimanche soir au domicile du
--   salarie.
--
--   Les distinguer permet trois choses qui serviront : filtrer la carte
--   sur les seuls actes de travail, repondre precisement a un salarie
--   qui demande ce qui est enregistre sur lui, et purger les connexions
--   plus tot que le reste si la decision change. Les melanger aurait
--   rendu ces trois choses impossibles sans reecrire la table.
--
-- LE LIEU N'EST PLUS EXIGE
--   Il ne l'etait deja pas -- site_id est facultatif depuis le debut.
--   Ce fichier ne fait que le confirmer et l'ecrire : le telephone
--   envoie sa position, rien d'autre. Quand un site est fourni, la base
--   calcule la distance ; sinon elle enregistre la position nue, et la
--   verification se fera plus tard, a la main, contre l'adresse du
--   client.
--
-- UN AN, ET UNE PURGE QUI EXISTE VRAIMENT
--   Une duree de conservation annoncee mais jamais appliquee est pire
--   que pas de duree : elle est ecrite dans la mention d'information
--   remise aux salaries, donc opposable, et les donnees sont toujours
--   la. La fonction de purge est donc ecrite maintenant, avec la duree.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. 'connexion' rejoint les types de releve
--
-- La contrainte est reconstruite comme l'UNION de la liste voulue et
-- des valeurs DEJA presentes en base. Elle ne peut donc jamais se
-- retrecir sous les donnees existantes -- meme parade que pour
-- entreprises_plan_check, qui nous avait coute une inscription cassee.
-- ---------------------------------------------------------------------
do $$
declare
  v_voulus text[] := array['tache_terminee', 'photo', 'visite', 'intervention_debut', 'connexion'];
  v_final  text[];
  v_def    text;
begin
  select array(
    select distinct x from (
      select unnest(v_voulus) as x
      union
      select distinct action_type from public.releves_position where action_type is not null
    ) t order by x
  ) into v_final;

  alter table public.releves_position
    drop constraint if exists releves_position_action_type_check;

  v_def := 'alter table public.releves_position add constraint releves_position_action_type_check '
           || 'check (action_type = any (array['
           || (select string_agg(quote_literal(a) || '::text', ', ') from unnest(v_final) a)
           || ']))';
  execute v_def;

  raise notice 'Types de releve acceptes : %', array_to_string(v_final, ', ');
end $$;

-- ---------------------------------------------------------------------
-- 2. La duree de conservation, ecrite une fois
--
-- Une fonction plutot qu'une constante eparpillee : la purge, l'ecran
-- et la mention d'information doivent citer le MEME nombre. Un chiffre
-- recopie a trois endroits finit par differer, et c'est celui de la
-- mention qui engage juridiquement.
-- ---------------------------------------------------------------------
drop function if exists public.duree_conservation_position_jours();

create function public.duree_conservation_position_jours()
returns integer
language sql
immutable
as $$ select 365; $$;

comment on function public.duree_conservation_position_jours() is
  'Duree de conservation des releves de position, en jours. Source '
  'unique : la purge et la mention d''information doivent citer ce meme '
  'nombre.';

-- ---------------------------------------------------------------------
-- 3. LA PURGE
--
-- Supprime ce qui a depasse la duree. C'est la SEULE suppression admise
-- sur cette table : il n'existe toujours aucune politique DELETE, donc
-- personne ne peut effacer un releve genant a la main.
--
-- Renvoie le nombre de lignes supprimees plutot que rien : une purge
-- qui ne dit pas ce qu'elle a fait ne se verifie pas.
-- ---------------------------------------------------------------------
drop function if exists public.purger_releves_position();

create function public.purger_releves_position()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_supprimes integer;
begin
  delete from public.releves_position
  where releve_le < now() - (public.duree_conservation_position_jours() || ' days')::interval;

  get diagnostics v_supprimes = row_count;

  if v_supprimes > 0 then
    raise notice 'Releves de position purges (plus de % jours) : %',
      public.duree_conservation_position_jours(), v_supprimes;
  end if;

  return v_supprimes;
end $$;

revoke all on function public.purger_releves_position() from public;
revoke all on function public.purger_releves_position() from anon;
revoke all on function public.purger_releves_position() from authenticated;

comment on function public.purger_releves_position() is
  'Supprime les releves au-dela de la duree de conservation. A appeler '
  'periodiquement. Non exposee aux clients : ce n''est pas un geste '
  'd''utilisateur.';

-- ---------------------------------------------------------------------
-- 4. Le site redevient explicitement facultatif
--
-- Rien a modifier -- il l'etait deja. On le documente, pour que la
-- prochaine personne qui lit cette table sache que c'est un choix et
-- non un oubli.
-- ---------------------------------------------------------------------
comment on column public.releves_position.site_id is
  'Facultatif. Le telephone envoie sa position, pas un lieu. Quand un '
  'site est fourni, la base calcule la distance ; sinon la verification '
  'se fait plus tard, a la main, contre l''adresse du client.';

comment on column public.releves_position.action_type is
  'Ce qui justifie le releve. « connexion » est volontairement distinct '
  'des actions metier : il dit que l''application a ete ouverte ici, pas '
  'que le travail y a ete fait.';

commit;

-- =====================================================================
-- CONTROLE -- lire ces lignes, pas le mot « Success ».
-- =====================================================================
select 'Types de releve acceptes' as controle,
       (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid = 'public.releves_position'::regclass
           and conname = 'releves_position_action_type_check') as valeur,
       'doit citer connexion ET les actions metier' as attendu
union all
select 'Duree de conservation (jours)',
       public.duree_conservation_position_jours()::text,
       '365'
union all
select 'La purge existe',
       case when to_regprocedure('public.purger_releves_position()') is null
            then 'ABSENTE' else 'presente' end,
       'presente'
union all
select 'Suppression a la main toujours interdite',
       coalesce((select string_agg(cmd, ', ') from pg_policies
          where schemaname = 'public' and tablename = 'releves_position'
            and cmd = 'DELETE'), 'aucune politique DELETE'),
       'aucune politique DELETE'
union all
select 'Releves deja hors duree',
       (select count(*)::text from public.releves_position
         where releve_le < now() - (public.duree_conservation_position_jours() || ' days')::interval),
       '0 aujourd''hui';
