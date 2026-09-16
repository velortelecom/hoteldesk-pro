-- ============================================================================
-- INVENTAIRE DES SUPER ADMINS  --  LECTURE SEULE, ne modifie rien
--
-- A coller dans le SQL Editor Supabase (projet vcpnrisxbnvyupsbieie).
--
-- L'editeur n'affiche que le resultat de la DERNIERE requete : joue les
-- quatre blocs UN PAR UN (selectionne le bloc, puis Run / Ctrl+Entree).
-- ============================================================================


-- ############################################################################
-- BLOC 1 -- QUI EST SUPER ADMIN AUJOURD'HUI
-- ############################################################################

select
  p.id,
  u.email,
  p.prenom,
  p.nom,
  p.actif,
  p.role,
  e.nom                                        as entreprise,
  u.created_at::date                           as compte_cree_le,
  u.last_sign_in_at                            as derniere_connexion,
  case when lower(u.email) = 'senbati_mohamed@hotmail.fr'
       then 'A GARDER' else 'a retirer' end    as decision
from public.profiles p
join auth.users u on u.id = p.id
left join public.entreprises e on e.id = p.entreprise_id
where p.is_super_admin = true
order by decision, u.last_sign_in_at desc nulls last;


-- ############################################################################
-- BLOC 2 -- LE COMPTE A GARDER EXISTE-T-IL, ET UNE SEULE FOIS
-- ############################################################################

select
  count(*)                                     as nb_comptes_trouves,
  min(u.id::text)                              as id,
  min(p.is_super_admin::text)                  as deja_super_admin
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = 'senbati_mohamed@hotmail.fr';
-- attendu : nb_comptes_trouves = 1  et  deja_super_admin = true


-- ############################################################################
-- BLOC 3 -- CE QUI POINTE VERS profiles, ET CE QUE FAIT UN DELETE
--
-- NO ACTION / RESTRICT  -> bloque la suppression du compte
-- CASCADE               -> emporte les lignes filles
-- SET NULL              -> vide la colonne, garde la ligne
-- ############################################################################

select
  src.relname                                  as table_qui_reference,
  att.attname                                  as colonne,
  case con.confdeltype
    when 'a' then 'NO ACTION  (bloque)'
    when 'r' then 'RESTRICT   (bloque)'
    when 'c' then 'CASCADE    (supprime les lignes filles)'
    when 'n' then 'SET NULL   (vide la colonne)'
    when 'd' then 'SET DEFAULT'
  end                                          as au_delete
from pg_constraint con
join pg_class src on src.oid = con.conrelid
join pg_class tgt on tgt.oid = con.confrelid
join pg_namespace n on n.oid = tgt.relnamespace
join unnest(con.conkey) with ordinality as k(attnum, ord) on true
join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
where con.contype = 'f'
  and n.nspname = 'public'
  and tgt.relname = 'profiles'
order by au_delete, src.relname;


-- ############################################################################
-- BLOC 4 -- CE QUE LES COMPTES A RETIRER ONT LAISSE DERRIERE EUX
--
-- Ne suppose aucun nom de colonne : parcourt les cles etrangeres reelles
-- vers profiles et compte, table par table, les lignes rattachees aux
-- super admins autres que celui qu'on garde.
-- Joue ce bloc en entier d'un coup (les trois instructions ensemble).
-- ############################################################################

drop table if exists zz_traces;
create temp table zz_traces (
  table_qui_reference text,
  colonne             text,
  au_delete           text,
  lignes              bigint
);

do $$
declare
  r      record;
  n      bigint;
begin
  for r in
    select src.relname as tbl,
           att.attname as col,
           case con.confdeltype
             when 'a' then 'NO ACTION (bloque)'
             when 'r' then 'RESTRICT  (bloque)'
             when 'c' then 'CASCADE'
             when 'n' then 'SET NULL'
             when 'd' then 'SET DEFAULT'
           end as act
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace n2 on n2.oid = tgt.relnamespace
    join unnest(con.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
    where con.contype = 'f'
      and n2.nspname = 'public'
      and tgt.relname = 'profiles'
  loop
    execute format($f$
      select count(*) from public.%I t
      where t.%I in (
        select p.id from public.profiles p
        join auth.users u on u.id = p.id
        where p.is_super_admin = true
          and lower(u.email) <> 'senbati_mohamed@hotmail.fr'
      )$f$, r.tbl, r.col)
    into n;

    if n > 0 then
      insert into zz_traces values (r.tbl, r.col, r.act, n);
    end if;
  end loop;
end
$$;

select * from zz_traces order by lignes desc;
-- Aucune ligne rendue = les comptes a retirer n'ont rien laisse,
-- leur suppression sera propre.
