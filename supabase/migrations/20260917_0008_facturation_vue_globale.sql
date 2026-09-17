-- =====================================================================
-- 20260917_0008 : VUE GLOBALE DE FACTURATION (Super Admin)
--
-- etat_facturation() repond pour UNE entreprise, et c'est ce qu'il faut
-- cote client. Le Super Admin, lui, a besoin de la liste : appeler la
-- fonction une fois par entreprise ferait autant d'allers-retours que de
-- clients, et un ecran qui se remplit ligne par ligne finit toujours par
-- afficher un total incomplet sans le dire.
--
-- ON N'AJOUTE PAS UN DEUXIEME CALCUL. Cette fonction appelle
-- etat_facturation() en boucle laterale : le montant affiche au Super
-- Admin est, par construction, celui que voit le client et celui que
-- figera figer_releves_facturation(). C'est la seule facon de ne pas
-- refaire le coup des quatre definitions de packs divergentes.
--
-- fige : le releve du mois demande existe-t-il deja ? C'est ce qui dit
-- au Super Admin si un clic sur « Figer » aura un effet, plutot que de
-- lui laisser croire qu'il n'a rien fait.
-- =====================================================================
-- DROP avant CREATE : le RETURNS TABLE evolue, et CREATE OR REPLACE
-- refuse de changer un type de retour.
DROP FUNCTION IF EXISTS public.etat_facturation_global(date);

CREATE FUNCTION public.etat_facturation_global(p_periode date DEFAULT NULL)
RETURNS TABLE (
  entreprise_id         uuid,
  nom                   text,
  plan                  text,
  actif                 boolean,
  utilisateurs          integer,
  inclus                integer,
  surplus               integer,
  prix_base             numeric,
  prix_utilisateur_sup  numeric,
  supplement            numeric,
  prix_total            numeric,
  sur_devis             boolean,
  -- Fait partie des cinq premieres entreprises, donc a 29 EUR bloques a
  -- vie. Sans cette colonne, un 29 EUR dans le tableau se confond avec
  -- une erreur de prix -- le tarif public est 39 EUR.
  tarif_fondateur       boolean,
  fige                  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periode date;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'ACCES_REFUSE'
      USING DETAIL = 'Vue globale de facturation reservee au super admin.';
  END IF;

  v_periode := date_trunc('month', COALESCE(p_periode, current_date))::date;

  RETURN QUERY
  SELECT
    e.id,
    e.nom,
    f.plan,
    COALESCE(e.actif, true),
    f.utilisateurs,
    f.inclus,
    f.surplus,
    f.prix_base,
    f.prix_utilisateur_sup,
    f.supplement,
    f.prix_total,
    f.sur_devis,
    f.tarif_fondateur,
    EXISTS (
      SELECT 1 FROM public.releves_facturation r
      WHERE r.entreprise_id = e.id AND r.periode = v_periode
    )
  FROM public.entreprises e
  CROSS JOIN LATERAL public.etat_facturation(e.id) f
  ORDER BY e.nom;
END;
$$;

REVOKE ALL ON FUNCTION public.etat_facturation_global(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.etat_facturation_global(date) TO authenticated;

COMMENT ON FUNCTION public.etat_facturation_global(date) IS
  'Liste de facturation de toutes les entreprises pour une periode, avec '
  'l''indicateur fige. Reserve au super admin. Reutilise etat_facturation() '
  'pour qu''il n''existe jamais deux calculs du meme montant.';

NOTIFY pgrst, 'reload schema';
