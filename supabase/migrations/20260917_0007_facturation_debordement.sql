-- =====================================================================
-- 20260917_0007 : FACTURATION DU DEBORDEMENT
--
-- CE QUI MANQUAIT
--   entreprises.max_utilisateurs existe depuis le premier jour et n'est
--   LU par personne : ni pour bloquer, ni pour facturer. Une entreprise a
--   39 EUR peut aujourd'hui compter vingt-cinq comptes actifs ;
--   l'application affiche 39 EUR, et la facture aussi. Le debordement a
--   2 EUR par utilisateur etait decide, ecrit dans offres.js, affiche sur
--   la page Offres -- et calcule nulle part.
--
-- CE QU'ON NE FAIT PAS : BLOQUER
--   Un plafond dur pousse le client a ne pas creer le 11e compte. Le 11e
--   salarie pointera alors sur le telephone d'un collegue, et le decompte
--   des heures -- la seule chose qui ait une valeur legale dans cet outil
--   -- devient faux. On facture le depassement, on ne l'empeche pas. Le
--   seul plafond dur reste celui du forfait lui-meme : au-dela de 30
--   utilisateurs on ne facture plus au forfait, on etablit un devis.
--
-- POURQUOI UN RELEVE FIGE, ET PAS SEULEMENT UN CALCUL
--   L'effectif bouge en cours de mois. Un calcul en direct veut dire
--   qu'une facture envoyee le 5 n'affiche plus le meme montant le 20, et
--   qu'un client qui la conteste a raison. Le releve FIGE le compte une
--   fois par periode : c'est ce qu'on facture, et ce qu'on peut montrer.
--   Une periode deja figee n'est jamais reecrite (ON CONFLICT DO NOTHING).
--
-- LA BASE DE PRIX VIENT DE LA LIGNE ENTREPRISE, PAS DE LA GRILLE
--   prix_facture lit entreprises.prix_mensuel. C'est ce qui fait que le
--   tarif fondateur a 29 EUR survit : le fondateur qui passe a 12
--   utilisateurs paie 29 + 2 x 2 = 33 EUR, pas 39 + 4. Le blocage a vie
--   porte sur le prix du perimetre souscrit ; l'utilisateur en plus est
--   hors de ce perimetre et se facture au tarif normal.
--
-- QUI EST COMPTE
--   Les profils ACTIFS, super admin exclu.
--   - actif : un employe desactive a quitte l'entreprise. On ne le
--     facture plus, mais on garde son historique de pointage -- c'est
--     exactement pour ca que la desactivation existe au lieu de la
--     suppression.
--   - super admin exclu : le compte de supervision de Velor Telecom n'a
--     rien a faire sur la facture d'un client.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LE COMPTE -- une seule definition
--
-- Fonction interne : elle accepte n'importe quel entreprise_id, donc elle
-- n'est PAS exposee a authenticated. Les appelants passent par
-- etat_facturation(), qui verifie les droits.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.utilisateurs_factures(p_entreprise_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.profiles p
  WHERE p.entreprise_id = p_entreprise_id
    AND COALESCE(p.actif, true) = true
    AND COALESCE(p.is_super_admin, false) = false;
$$;

REVOKE ALL ON FUNCTION public.utilisateurs_factures(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.utilisateurs_factures(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.utilisateurs_factures(uuid) FROM authenticated;

COMMENT ON FUNCTION public.utilisateurs_factures(uuid) IS
  'Nombre d''utilisateurs facturables d''une entreprise : profils actifs, '
  'super admin exclu. Fonction interne -- passer par etat_facturation().';

-- ---------------------------------------------------------------------
-- 2. LE CALCUL -- surface publique, avec controle d'acces
--
-- Sans argument : l'entreprise de l'appelant. Avec argument : reserve au
-- super admin, sauf s'il s'agit de sa propre entreprise.
-- ---------------------------------------------------------------------
-- Le DROP est indispensable : on fait evoluer le RETURNS TABLE, et
-- CREATE OR REPLACE refuse de changer un type de retour (« cannot change
-- return type of existing function »). Meme piege que pour la RPC
-- d'inscription quand on lui a ajoute p_formule.
DROP FUNCTION IF EXISTS public.etat_facturation(uuid);

CREATE FUNCTION public.etat_facturation(p_entreprise_id uuid DEFAULT NULL)
RETURNS TABLE (
  entreprise_id         uuid,
  plan                  text,
  utilisateurs          integer,
  inclus                integer,
  surplus               integer,
  prix_base             numeric,
  prix_utilisateur_sup  numeric,
  supplement            numeric,
  prix_total            numeric,
  sur_devis             boolean,
  -- Le tarif fondateur n'est PAS deductible du prix : une entreprise
  -- creee a la main par le Super Admin peut tres bien etre a 29 EUR sans
  -- etre fondatrice. On renvoie donc la colonne posee par le trigger,
  -- pas une devinette sur le montant. C'est aussi ce qui evite qu'un
  -- 29 EUR affiche sans explication passe pour une erreur de prix.
  tarif_fondateur       boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Ces trois constantes sont la copie SQL de UTILISATEURS_INCLUS,
  -- PRIX_UTILISATEUR_SUP et PLAFOND_FORFAIT (src/lib/offres.js).
  -- src/lib/offres.test.js relit ce fichier et casse le build si elles
  -- divergent : c'est le meme verrou que pour la RPC d'inscription.
  c_prix_utilisateur_sup constant numeric := 2;
  c_plafond_forfait      constant integer := 30;
  v_cible                uuid;
  v_ent                  record;
  v_nb                   integer;
  v_inclus               integer;
  v_surplus              integer;
BEGIN
  v_cible := COALESCE(p_entreprise_id, public.get_my_entreprise_id());

  IF v_cible IS NULL THEN
    RETURN;
  END IF;

  IF v_cible <> COALESCE(public.get_my_entreprise_id(), '00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'ACCES_REFUSE'
      USING DETAIL = 'Etat de facturation reserve a l''entreprise concernee.';
  END IF;

  SELECT e.id, e.plan, e.prix_mensuel, e.max_utilisateurs, e.tarif_fondateur
    INTO v_ent
  FROM public.entreprises e
  WHERE e.id = v_cible;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_nb := public.utilisateurs_factures(v_cible);

  -- max_utilisateurs a ete rempli avec 0 ou 999 par d'anciens ecrans du
  -- Super Admin. Un 0 ferait facturer chaque utilisateur en supplement,
  -- un 999 n'en ferait facturer aucun. On ne devine pas : si la valeur
  -- n'est pas utilisable, on ne facture pas de supplement et on le dit en
  -- laissant inclus a NULL.
  v_inclus := CASE
                WHEN v_ent.max_utilisateurs IS NULL THEN NULL
                WHEN v_ent.max_utilisateurs <= 0 THEN NULL
                WHEN v_ent.max_utilisateurs > c_plafond_forfait THEN NULL
                ELSE v_ent.max_utilisateurs
              END;

  v_surplus := CASE
                 WHEN v_inclus IS NULL THEN 0
                 ELSE GREATEST(0, v_nb - v_inclus)
               END;

  RETURN QUERY SELECT
    v_ent.id,
    v_ent.plan,
    v_nb,
    v_inclus,
    v_surplus,
    v_ent.prix_mensuel::numeric,
    c_prix_utilisateur_sup,
    -- Supplement facture au forfait. Il vaut 0 dans deux cas ou il n'y a
    -- rien a facturer au forfait, et ou afficher un montant mentirait :
    --   - plan gratuit : son plafond est un VRAI plafond. Depasser 3
    --     utilisateurs n'ajoute pas 2 EUR, cela veut dire qu'il faut
    --     passer a Velor One.
    --   - au-dela de 30 utilisateurs : on sort du forfait, le montant
    --     vient d'un devis. Laisser ici 21 x 2 = 42 EUR laisserait croire
    --     que c'est ce qu'on facture.
    -- Dans les deux cas le SURPLUS reste renseigne : c'est lui qui permet
    -- a l'interface de dire ce qui se passe.
    CASE
      WHEN v_nb > c_plafond_forfait THEN 0::numeric
      WHEN v_ent.plan = 'gratuit' THEN 0::numeric
      ELSE (v_surplus * c_prix_utilisateur_sup)::numeric
    END,
    CASE
      WHEN v_nb > c_plafond_forfait THEN NULL
      WHEN v_ent.prix_mensuel IS NULL THEN NULL
      WHEN v_ent.plan = 'gratuit' THEN v_ent.prix_mensuel::numeric
      ELSE (v_ent.prix_mensuel + v_surplus * c_prix_utilisateur_sup)::numeric
    END,
    (v_nb > c_plafond_forfait),
    COALESCE(v_ent.tarif_fondateur, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.etat_facturation(uuid) TO authenticated;

COMMENT ON FUNCTION public.etat_facturation(uuid) IS
  'Montant reellement du par une entreprise ce mois-ci : prix de sa ligne '
  '(tarif fondateur compris) + 2 EUR par utilisateur au-dela de son forfait. '
  'sur_devis = true au-dela de 30 utilisateurs, et prix_total vaut alors NULL.';

-- ---------------------------------------------------------------------
-- 3. LE RELEVE MENSUEL -- ce qui se facture
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.releves_facturation (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id         uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  -- Toujours le 1er du mois : une periode, une ligne.
  periode               date NOT NULL,
  plan                  text,
  utilisateurs          integer NOT NULL,
  inclus                integer,
  surplus               integer NOT NULL DEFAULT 0,
  prix_base             numeric(10,2),
  prix_utilisateur_sup  numeric(10,2) NOT NULL,
  supplement            numeric(10,2) NOT NULL DEFAULT 0,
  prix_total            numeric(10,2),
  sur_devis             boolean NOT NULL DEFAULT false,
  -- Fige avec le reste : dans deux ans, un releve a 29 EUR doit pouvoir
  -- s'expliquer tout seul, sans aller rechercher si cette entreprise
  -- faisait partie des cinq premieres.
  tarif_fondateur       boolean NOT NULL DEFAULT false,
  fige_le               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT releves_facturation_periode_unique UNIQUE (entreprise_id, periode),
  CONSTRAINT releves_facturation_periode_1er CHECK (date_trunc('month', periode)::date = periode)
);

-- Pour une base ou la table a ete creee avant l'ajout de la colonne.
ALTER TABLE public.releves_facturation
  ADD COLUMN IF NOT EXISTS tarif_fondateur boolean NOT NULL DEFAULT false;

COMMENT ON TABLE public.releves_facturation IS
  'Effectif et montant FIGES pour une periode. Ce qu''on facture. '
  'Une periode deja figee n''est jamais reecrite.';

CREATE INDEX IF NOT EXISTS idx_releves_facturation_periode
  ON public.releves_facturation (periode DESC, entreprise_id);

ALTER TABLE public.releves_facturation ENABLE ROW LEVEL SECURITY;

-- Lecture : sa propre entreprise, ou tout pour le super admin. Un client
-- doit pouvoir verifier ce qu'on lui facture.
DROP POLICY IF EXISTS releves_facturation_select ON public.releves_facturation;
CREATE POLICY releves_facturation_select ON public.releves_facturation
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR entreprise_id = public.get_my_entreprise_id()
  );

-- Aucune ecriture depuis l'application : un releve se fige par la
-- fonction ci-dessous, jamais a la main depuis le navigateur.
REVOKE ALL ON public.releves_facturation FROM anon;
GRANT SELECT ON public.releves_facturation TO authenticated;

-- ---------------------------------------------------------------------
-- 4. FIGER UNE PERIODE
--
-- Idempotent : relancable autant de fois qu'on veut dans le mois, et une
-- periode deja figee ne bouge plus. Renvoie le nombre de lignes creees.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.figer_releves_facturation(p_periode date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periode date;
  v_crees   integer := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'ACCES_REFUSE'
      USING DETAIL = 'Figer un releve de facturation est reserve au super admin.';
  END IF;

  v_periode := date_trunc('month', COALESCE(p_periode, current_date))::date;

  INSERT INTO public.releves_facturation (
    entreprise_id, periode, plan, utilisateurs, inclus, surplus,
    prix_base, prix_utilisateur_sup, supplement, prix_total, sur_devis,
    tarif_fondateur
  )
  SELECT
    f.entreprise_id, v_periode, f.plan, f.utilisateurs, f.inclus, f.surplus,
    f.prix_base, f.prix_utilisateur_sup, f.supplement, f.prix_total, f.sur_devis,
    f.tarif_fondateur
  FROM public.entreprises e
  CROSS JOIN LATERAL public.etat_facturation(e.id) f
  WHERE COALESCE(e.actif, true) = true
  ON CONFLICT (entreprise_id, periode) DO NOTHING;

  GET DIAGNOSTICS v_crees = ROW_COUNT;
  RETURN v_crees;
END;
$$;

REVOKE ALL ON FUNCTION public.figer_releves_facturation(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.figer_releves_facturation(date) TO authenticated;

COMMENT ON FUNCTION public.figer_releves_facturation(date) IS
  'Fige l''effectif et le montant de toutes les entreprises actives pour '
  'une periode (par defaut le mois en cours). Idempotent : une periode '
  'deja figee n''est pas reecrite. Reserve au super admin.';

NOTIFY pgrst, 'reload schema';
