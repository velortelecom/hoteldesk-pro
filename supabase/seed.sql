BEGIN;

INSERT INTO public.modules_catalogue (id, nom, description, icone, plan_minimum, categorie, actif, ordre)
VALUES
  ('organisation', 'Organisation & RH', 'Gestion des employés, départements, postes et organigramme', '🏢', 'starter', 'rh', true, 5),
  ('pointage', 'Pointage', 'Suivi du pointage et de la présence', '⏱️', 'starter', 'rh', true, 10),
  ('conges', 'Conges & Absences', 'Demandes de congés et absences', '🏖', 'business', 'rh', true, 15),
  ('planning_avance', 'Planning Avance', 'Planification enrichie et capacité', '🗂', 'premium', 'planification', true, 130),
  ('rapports', 'Rapports Avances', 'Tableaux de bord et analytics', '📊', 'business', 'analyse', true, 120)
ON CONFLICT (id) DO UPDATE
SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  icone = EXCLUDED.icone,
  plan_minimum = EXCLUDED.plan_minimum,
  categorie = EXCLUDED.categorie,
  actif = EXCLUDED.actif,
  ordre = EXCLUDED.ordre;

COMMIT;