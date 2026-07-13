BEGIN;

-- Commercial source of truth: only Super Admin can change module activation.
DROP POLICY IF EXISTS entreprise_modules_insert ON public.entreprise_modules;
DROP POLICY IF EXISTS entreprise_modules_update ON public.entreprise_modules;
DROP POLICY IF EXISTS entreprise_modules_delete ON public.entreprise_modules;
DROP POLICY IF EXISTS entreprise_modules_manage ON public.entreprise_modules;

CREATE POLICY entreprise_modules_insert ON public.entreprise_modules
FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY entreprise_modules_update ON public.entreprise_modules
FOR UPDATE USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY entreprise_modules_delete ON public.entreprise_modules
FOR DELETE USING (public.is_super_admin());

COMMIT;
