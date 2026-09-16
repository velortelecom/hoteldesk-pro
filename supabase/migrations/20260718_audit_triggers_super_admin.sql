BEGIN;

CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid := auth.uid();
  v_actor_email text;
  v_entreprise_id uuid;
  v_cible_id uuid;
  v_action text;
  v_description text;
  v_type_cible text;
  v_metadata jsonb := '{}'::jsonb;
  v_old_actif boolean;
  v_new_actif boolean;
BEGIN
  IF v_actor_profile_id IS NOT NULL THEN
    SELECT u.email INTO v_actor_email FROM auth.users u WHERE u.id = v_actor_profile_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_cible_id := OLD.id;
    v_entreprise_id := OLD.entreprise_id;
  ELSE
    v_cible_id := NEW.id;
    v_entreprise_id := NEW.entreprise_id;
  END IF;

  IF TG_TABLE_NAME = 'entreprises' THEN
    v_type_cible := 'entreprise';
    IF TG_OP = 'INSERT' THEN
      v_action := 'creation_entreprise';
      v_description := 'Création entreprise';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'suppression_entreprise';
      v_description := 'Suppression entreprise';
    ELSE
      v_old_actif := COALESCE(OLD.actif, true);
      v_new_actif := COALESCE(NEW.actif, true);
      IF v_old_actif IS DISTINCT FROM v_new_actif THEN
        v_action := CASE WHEN v_new_actif THEN 'reactivation_entreprise' ELSE 'suspension_entreprise' END;
        v_description := CASE WHEN v_new_actif THEN 'Réactivation entreprise' ELSE 'Suspension entreprise' END;
      ELSE
        v_action := 'modification_entreprise';
        v_description := 'Modification entreprise';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'entreprise_modules' THEN
    v_type_cible := 'module';
    IF TG_OP = 'DELETE' THEN
      v_action := 'desactivation_module';
      v_description := 'Désactivation module';
    ELSIF TG_OP = 'INSERT' THEN
      v_action := CASE WHEN COALESCE(NEW.actif, false) THEN 'activation_module' ELSE 'desactivation_module' END;
      v_description := CASE WHEN COALESCE(NEW.actif, false) THEN 'Activation module' ELSE 'Désactivation module' END;
    ELSE
      v_action := CASE WHEN COALESCE(NEW.actif, false) THEN 'activation_module' ELSE 'desactivation_module' END;
      v_description := CASE WHEN COALESCE(NEW.actif, false) THEN 'Activation module' ELSE 'Désactivation module' END;
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    v_type_cible := 'utilisateur';
    IF TG_OP = 'INSERT' THEN
      v_action := 'creation_utilisateur';
      v_description := 'Création utilisateur';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'suppression_utilisateur';
      v_description := 'Suppression utilisateur';
    ELSE
      v_action := 'modification_utilisateur';
      v_description := 'Modification utilisateur';
    END IF;
  ELSIF TG_TABLE_NAME = 'sites' THEN
    v_type_cible := 'site';
    IF TG_OP = 'INSERT' THEN
      v_action := 'creation_site';
      v_description := 'Création site';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'suppression_site';
      v_description := 'Suppression site';
    ELSE
      v_action := 'modification_site';
      v_description := 'Modification site';
    END IF;
  ELSIF TG_TABLE_NAME = 'departements' THEN
    v_type_cible := 'departement';
    IF TG_OP = 'INSERT' THEN
      v_action := 'creation_departement';
      v_description := 'Création département';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'suppression_departement';
      v_description := 'Suppression département';
    ELSE
      v_action := 'modification_departement';
      v_description := 'Modification département';
    END IF;
  ELSIF TG_TABLE_NAME = 'postes' THEN
    v_type_cible := 'poste';
    IF TG_OP = 'INSERT' THEN
      v_action := 'creation_poste';
      v_description := 'Création poste';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'suppression_poste';
      v_description := 'Suppression poste';
    ELSE
      v_action := 'modification_poste';
      v_description := 'Modification poste';
    END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_metadata := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP);

  PERFORM public.record_audit_event(
    v_actor_profile_id,
    v_actor_email,
    v_entreprise_id,
    v_action,
    v_type_cible,
    v_cible_id,
    v_description,
    v_metadata,
    NULL,
    NULL
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_entreprises ON public.entreprises;
CREATE TRIGGER trg_audit_entreprises
AFTER INSERT OR UPDATE OR DELETE ON public.entreprises
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_entreprise_modules ON public.entreprise_modules;
CREATE TRIGGER trg_audit_entreprise_modules
AFTER INSERT OR UPDATE OR DELETE ON public.entreprise_modules
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_sites ON public.sites;
CREATE TRIGGER trg_audit_sites
AFTER INSERT OR UPDATE OR DELETE ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_departements ON public.departements;
CREATE TRIGGER trg_audit_departements
AFTER INSERT OR UPDATE OR DELETE ON public.departements
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_postes ON public.postes;
CREATE TRIGGER trg_audit_postes
AFTER INSERT OR UPDATE OR DELETE ON public.postes
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

COMMIT;
