-- ############################################################################
-- SUPPRIMER UN COMPTE : reserve a l'administrateur
--
-- Meme regle que pour les taches : le responsable cree et modifie, il ne
-- supprime pas. Aujourd'hui supprimer_membre_complet accepte encore
-- 'admin' OU 'responsable'.
--
-- COMMENT CE SCRIPT S'Y PREND
--   Il ne reecrit PAS la fonction de memoire. Il lit sa definition reelle
--   en production, remplace la seule ligne concernee, et la reapplique.
--   Tout le reste -- la liste des tables nettoyees, l'ordre des operations,
--   les garde-fous -- reste exactement ce qu'il est aujourd'hui.
--
--   C'est important : le depot et la production ont deja diverge plusieurs
--   fois sur ce projet. Reecrire la fonction depuis le fichier versionne
--   aurait pu effacer une correction posee directement en base.
--
--   Si la ligne attendue n'est pas trouvee, le script ECHOUE sans rien
--   modifier plutot que de laisser croire a une correction appliquee.
-- ############################################################################

do $do$
declare
  v_def text;
  v_neuf text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'supprimer_membre_complet'
    and p.prokind = 'f'
  limit 1;

  if v_def is null then
    raise exception 'Fonction supprimer_membre_complet introuvable : rien n a ete modifie.';
  end if;

  v_neuf := replace(
    v_def,
    $q$IF v_caller.role NOT IN ('admin', 'responsable') THEN$q$,
    $q$IF v_caller.role <> 'admin' THEN$q$
  );

  if v_neuf = v_def then
    raise exception
      'La ligne attendue n a pas ete trouvee dans la fonction : rien n a ete modifie. Envoie-moi sa definition actuelle.';
  end if;

  execute v_neuf;
end
$do$;


-- ############################################################################
-- CONTROLE (lecture seule)
--
-- Attendu : "responsable" ne doit plus figurer dans le controle des droits.
-- La colonne garde_admin_seul doit valoir "oui".
-- ############################################################################

select p.proname as fonction,
       case when pg_get_functiondef(p.oid) like '%NOT IN (''admin'', ''responsable'')%'
            then 'NON -- le responsable peut encore supprimer'
            else 'oui'
       end as garde_admin_seul,
       case when pg_get_functiondef(p.oid) like '%v_caller.role <> ''admin''%'
            then 'presente'
            else 'ABSENTE'
       end as nouvelle_condition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'supprimer_membre_complet'
  and p.prokind = 'f';
