-- ############################################################################
-- DROITS SUR LES TACHES + FIN DES ECARTS DE CASSE
--
-- TROIS CHOSES, DANS CET ORDRE
--
-- 1. SUPPRIMER : seul l'administrateur.
--    Aujourd'hui un responsable peut supprimer les taches de son
--    departement. Decision prise : on ne supprime pas ce qu'on nous a
--    confie, et le responsable non plus. Il cree, il modifie, il ne
--    supprime pas.
--
-- 2. MODIFIER : le responsable retrouve son departement.
--    Les regles de modification et de suppression comparaient le
--    departement d'une tache au NOM de l'equipe :
--        d.nom = taches.departement
--    alors que la tache stocke le CODE. "Cuisine" = "cuisine" est faux pour
--    Postgres : la condition ne se verifiait jamais. Un responsable voyait
--    les taches de son equipe sans pouvoir y toucher -- et sans message,
--    puisque la base filtre la ligne au lieu de refuser.
--
-- 3. LA CASSE NE DOIT PLUS JAMAIS DECIDER DE RIEN.
--    Les comparaisons passent en lower(...) des deux cotes, et les codes de
--    departement sont normalises a l'ecriture par un declencheur :
--    minuscules, sans accents, sans espaces. Le NOM affiche ne change pas --
--    "Cuisine" reste "Cuisine" a l'ecran.
--
-- CE QUI NE CHANGE PAS
--    Les postes ne sont pas concernes : ils sont relies par identifiant, pas
--    par texte. Aucun ecart de casse n'est possible entre eux.
-- ############################################################################

begin;

-- ---------------------------------------------------------------------------
-- 1. Normaliser les codes existants, et faire suivre les taches
--
-- Les deux vont ensemble : changer un code sans mettre a jour les taches qui
-- le referencent les rendrait invisibles. Si une normalisation provoquait un
-- doublon de code dans une entreprise, la transaction entiere echoue et rien
-- n'est applique -- c'est voulu.
-- ---------------------------------------------------------------------------
create or replace function public.normaliser_code_departement(p_code text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '_' from
      regexp_replace(
        lower(translate(coalesce(p_code, ''),
          'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ',
          'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy')),
        '[^a-z0-9]+', '_', 'g')
    ), '')
$$;

-- Les taches d'abord : elles doivent pointer sur le nouveau code.
update public.taches t
set departement = public.normaliser_code_departement(d.code)
from public.departements d
where d.entreprise_id = t.entreprise_id
  and t.departement = d.code
  and d.code is distinct from public.normaliser_code_departement(d.code);

update public.departements d
set code = public.normaliser_code_departement(d.code)
where d.code is distinct from public.normaliser_code_departement(d.code);

-- Et pour l'avenir : un code mal saisi est corrige a l'ecriture.
create or replace function public.trg_normaliser_code_departement()
returns trigger
language plpgsql
as $$
BEGIN
  NEW.code := public.normaliser_code_departement(NEW.code);
  RETURN NEW;
END;
$$;

drop trigger if exists normaliser_code on public.departements;
create trigger normaliser_code
before insert or update of code on public.departements
for each row execute function public.trg_normaliser_code_departement();


-- ---------------------------------------------------------------------------
-- 2. Qui voit quoi -- inchange sur le fond, insensible a la casse
-- ---------------------------------------------------------------------------
drop policy if exists taches_select on public.taches;

create policy taches_select on public.taches
for select using (
  public.is_super_admin()
  or (
    entreprise_id = public.get_my_entreprise_id()
    and (
      public.get_my_role() = 'admin'
      or assigne_a = auth.uid()
      or cree_par = auth.uid()
      or (
        assigne_a is null
        and (
          departement is null
          or exists (
            select 1
            from public.employe_departements ed
            join public.departements d on d.id = ed.departement_id
            where ed.profile_id = auth.uid()
              and lower(d.code) = lower(taches.departement)
          )
          or lower(departement) = lower((select p.departement from public.profiles p where p.id = auth.uid()))
        )
      )
    )
  )
);


-- ---------------------------------------------------------------------------
-- 3. Qui peut modifier -- le responsable retrouve son departement
-- ---------------------------------------------------------------------------
drop policy if exists taches_update on public.taches;

create policy taches_update on public.taches
for update using (
  public.is_super_admin()
  or (
    entreprise_id = public.get_my_entreprise_id()
    and (
      public.get_my_role() = 'admin'

      -- Celui qui a cree la tache peut la corriger.
      or cree_par = auth.uid()

      -- Le destinataire fait avancer la sienne (statut, avancement).
      or assigne_a = auth.uid()

      -- Le responsable, sur son perimetre : les taches confiees a quelqu'un
      -- de son equipe, ou adressees a son equipe. La comparaison porte
      -- desormais sur le CODE, et sans distinction de casse.
      or (
        public.get_my_role() = 'responsable'
        and (
          (assigne_a is not null and exists (
            select 1
            from public.employe_departements ed_r
            join public.employe_departements ed_e on ed_e.departement_id = ed_r.departement_id
            where ed_r.profile_id = auth.uid()
              and ed_e.profile_id = taches.assigne_a
          ))
          or (assigne_a is null and exists (
            select 1
            from public.employe_departements ed_r
            join public.departements d on d.id = ed_r.departement_id
            where ed_r.profile_id = auth.uid()
              and lower(d.code) = lower(taches.departement)
          ))
        )
      )
    )
  )
)
with check (
  public.is_super_admin()
  or entreprise_id = public.get_my_entreprise_id()
);


-- ---------------------------------------------------------------------------
-- 4. Qui peut supprimer -- l'administrateur, et personne d'autre
--
-- Ni le destinataire, ni le createur, ni le responsable. Une tache confiee
-- ne doit pas pouvoir disparaitre de la main de celui qui devait la faire.
-- ---------------------------------------------------------------------------
drop policy if exists taches_delete on public.taches;

create policy taches_delete on public.taches
for delete using (
  public.is_super_admin()
  or (
    entreprise_id = public.get_my_entreprise_id()
    and public.get_my_role() = 'admin'
  )
);

commit;


-- ############################################################################
-- CONTROLE (lecture seule)
--
-- A : plus aucun code de departement hors norme.
-- B : plus aucune tache pointant vers un code inexistant.
-- ############################################################################

select 'A - code non normalise' as controle,
       d.nom as detail,
       d.code as valeur
from public.departements d
where d.code is distinct from public.normaliser_code_departement(d.code)

union all

select 'B - tache orpheline',
       t.titre,
       t.departement
from public.taches t
where t.departement is not null
  and not exists (
    select 1 from public.departements d
    where d.entreprise_id = t.entreprise_id
      and lower(d.code) = lower(t.departement)
  )

order by 1, 2;
