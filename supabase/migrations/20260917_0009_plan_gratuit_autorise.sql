-- =====================================================================
-- 20260917_0009 : AUTORISER LE PLAN 'gratuit'
--
-- CE QUI S'EST PASSE
--   entreprises_plan_check date d'avant l'offre gratuite. Elle
--   n'autorisait pas la valeur 'gratuit', donc toute inscription en
--   formule gratuite etait refusee par la base. L'Edge Function faisait
--   son travail -- rollback complet, aucune donnee conservee -- et le
--   visiteur lisait « La creation de votre espace n'a pas pu aboutir ».
--
--   L'inscription payante passait, elle, parce que 'starter' etait dans
--   la liste. Le bug etait donc invisible tant qu'on ne testait que la
--   formule payante. C'est exactement pourquoi on testait les deux.
--
-- POURQUOI UN BLOC DYNAMIQUE PLUTOT QU'UN DROP/ADD ECRIT EN DUR
--   Reecrire la contrainte avec une liste ecrite a la main, c'est risquer
--   d'oublier une valeur deja presente en base : la contrainte passerait
--   (elle n'est verifiee que sur les lignes ecrites ensuite), puis la
--   premiere mise a jour d'une entreprise au plan oublie echouerait, des
--   mois plus tard, sans rapport visible avec cette migration.
--
--   On construit donc la liste comme l'UNION de deux choses :
--     - les cinq formules de la grille commerciale (src/lib/offres.js) ;
--     - tout plan REELLEMENT present dans la table aujourd'hui.
--   La contrainte ne peut ainsi jamais devenir plus stricte que les
--   donnees existantes.
--
-- IDEMPOTENT : relancable sans effet de bord.
-- =====================================================================
DO $$
DECLARE
  -- Les cinq identifiants de OFFRES (src/lib/offres.js). offres.test.js
  -- relit ce fichier et casse le build si la grille evolue sans que cette
  -- liste suive.
  c_formules constant text[] := ARRAY['gratuit', 'starter', 'business', 'premium', 'enterprise'];
  v_valeurs  text[];
  v_sql      text;
BEGIN
  SELECT array_agg(DISTINCT v ORDER BY v)
    INTO v_valeurs
  FROM (
    SELECT unnest(c_formules) AS v
    UNION
    SELECT DISTINCT e.plan FROM public.entreprises e WHERE e.plan IS NOT NULL
  ) t;

  ALTER TABLE public.entreprises DROP CONSTRAINT IF EXISTS entreprises_plan_check;

  v_sql := 'ALTER TABLE public.entreprises ADD CONSTRAINT entreprises_plan_check '
        || 'CHECK (plan = ANY (ARRAY['
        || (SELECT string_agg(quote_literal(x), ', ') FROM unnest(v_valeurs) x)
        || ']::text[]))';

  EXECUTE v_sql;

  RAISE NOTICE 'entreprises_plan_check recree. Valeurs autorisees : %',
    array_to_string(v_valeurs, ', ');
END $$;

COMMENT ON CONSTRAINT entreprises_plan_check ON public.entreprises IS
  'Formules autorisees. Doit contenir tous les identifiants de OFFRES '
  '(src/lib/offres.js) -- un identifiant manquant fait echouer l''inscription '
  'dans cette formule, avec un message generique cote visiteur.';
