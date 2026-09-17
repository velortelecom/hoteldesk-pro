-- =====================================================================
-- 20260918_0001 : LE PLAN GRATUIT N'EST PAS UN ESSAI
--
-- CE QUI SE PASSAIT
--   set_essai_14j pose une date_fin_abonnement a J+14 sur toute
--   entreprise dont origine = 'inscription_autonome'. La condition avait
--   ete resserree sur l'origine (migration 20260915_0003) pour qu'un
--   client cree au back-office n'herite pas d'un essai -- c'etait le bon
--   correctif a l'epoque, parce que la seule formule d'inscription
--   publique etait payante.
--
--   Depuis, la formule gratuite existe. Elle passe par la meme porte,
--   donc elle recevait elle aussi 14 jours, puis basculait en lecture
--   seule via trg_lecture_seule.
--
-- POURQUOI C'EST GRAVE
--   La page d'inscription annonce « 0 a 3 utilisateurs, gratuit ». Un
--   compte gratuit qui se verrouille au bout de deux semaines n'est pas
--   un bug d'affichage : c'est une promesse commerciale non tenue, et le
--   client s'en apercoit seul, un matin, sans prevenir. Le gratuit est
--   gratuit sans limite de duree -- sa limite est le nombre
--   d'utilisateurs (3), pas le temps.
--
-- CE QU'ON CHANGE
--   1. Le trigger saute la formule gratuite.
--   2. Les entreprises gratuites qui ont deja recu une date la perdent.
--
-- CE QU'ON NE TOUCHE PAS
--   Les essais en cours des entreprises PAYANTES. La mise a jour est
--   strictement limitee a plan = 'gratuit' : offrir par megarde un
--   abonnement illimite a un client payant serait la symetrie exacte du
--   bug qu'on corrige.
--
-- IDEMPOTENT : relancable sans effet de bord.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_essai_14j()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  -- Identifiant de la formule gratuite (OFFRE_GRATUITE, src/lib/offres.js).
  c_formule_gratuite constant text := 'gratuit';
BEGIN
  IF new.date_fin_abonnement IS NULL
     AND new.origine = 'inscription_autonome'
     AND coalesce(new.plan, '') <> c_formule_gratuite THEN
    new.date_fin_abonnement := now() + interval '14 days';
  END IF;
  RETURN new;
END;
$$;

-- Le trigger lui-meme ne change pas ; on le repose pour que ce fichier
-- soit rejouable seul.
DROP TRIGGER IF EXISTS trg_essai_14j ON public.entreprises;

CREATE TRIGGER trg_essai_14j
  BEFORE INSERT ON public.entreprises
  FOR EACH ROW
  EXECUTE FUNCTION public.set_essai_14j();

-- Rattrapage des entreprises gratuites deja creees avec une date de fin.
DO $$
DECLARE
  v_corrigees integer;
BEGIN
  UPDATE public.entreprises
     SET date_fin_abonnement = NULL
   WHERE plan = 'gratuit'
     AND date_fin_abonnement IS NOT NULL;

  GET DIAGNOSTICS v_corrigees = ROW_COUNT;
  RAISE NOTICE 'Entreprises gratuites liberees de leur date de fin : %', v_corrigees;
END $$;

COMMENT ON FUNCTION public.set_essai_14j() IS
  'Essai de 14 jours pour les inscriptions publiques PAYANTES. La formule '
  'gratuite en est exclue : sa limite est le nombre d''utilisateurs, pas la duree.';
