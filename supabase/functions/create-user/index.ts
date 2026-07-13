import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsonResponse, readJsonBody } from '../_shared/http.ts';
import { ALLOWED_ROLES, buildFallbackEmail, canGrantRole, generateTempPassword, isAllowedRole } from '../_shared/user_admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function corsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getCallerProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, entreprise_id, role, is_super_admin, actif')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) throw new Error('caller_profile_missing');
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return corsResponse({ success: false, error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return corsResponse({ success: false, error: 'server_misconfigured' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return corsResponse({ success: false, error: 'missing_token' }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user) return corsResponse({ success: false, error: 'invalid_token' }, 401);

  const payload = await readJsonBody(req);
  if (!payload) return corsResponse({ success: false, error: 'invalid_json' }, 400);

  const prenom = String(payload.prenom ?? '').trim();
  const nom = String(payload.nom ?? '').trim();
  const requestedRole = String(payload.role ?? 'employe').trim();
  const entrepriseId = String(payload.entreprise_id ?? '').trim();
  const emailInput = String(payload.email ?? '').trim();
  const telephone = payload.telephone ? String(payload.telephone).trim() : null;
  const posteId = payload.poste_id ? String(payload.poste_id).trim() : null;
  const posteSecondaireId = payload.poste_secondaire_id ? String(payload.poste_secondaire_id).trim() : null;
  const departementIds = Array.isArray(payload.departement_ids) ? payload.departement_ids.filter((id: unknown) => typeof id === 'string').map((id: string) => id.trim()).filter(Boolean) : [];
  const actif = payload.actif !== false;
  const langue = String(payload.langue ?? 'fr').trim() || 'fr';

  if (!prenom || !nom || !entrepriseId) return corsResponse({ success: false, error: 'missing_required_fields' }, 400);
  if (!isAllowedRole(requestedRole)) return corsResponse({ success: false, error: 'invalid_role' }, 400);
  if (!userData.user.email) return corsResponse({ success: false, error: 'missing_caller_email' }, 401);

  const caller = await getCallerProfile(supabase, userData.user.id);
  const isSuperAdmin = caller.is_super_admin === true;
  const allowed = canGrantRole({
    callerIsSuperAdmin: isSuperAdmin,
    callerRole: caller.role,
    callerEntrepriseId: caller.entreprise_id,
    targetEntrepriseId: entrepriseId,
    requestedRole: requestedRole as typeof ALLOWED_ROLES[number],
  });
  if (!allowed) return corsResponse({ success: false, error: 'forbidden' }, 403);

  let email = emailInput || buildFallbackEmail(prenom, nom, entrepriseId);
  const generatedPassword = generateTempPassword(16);

  const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
  if (existingUser?.user) {
    const localPart = email.split('@')[0];
    email = `${localPart}.${crypto.randomUUID().slice(0, 8)}@velor.local`;
  }

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: { prenom, nom, role: requestedRole, entreprise_id: entrepriseId },
  });
  if (createUserError || !createdUser.user) return corsResponse({ success: false, error: createUserError?.message || 'auth_create_failed' }, 400);

  try {
    const profilePayload: Record<string, unknown> = {
      id: createdUser.user.id,
      prenom,
      nom,
      role: requestedRole,
      entreprise_id: entrepriseId,
      telephone,
      poste_id: posteId,
      poste_secondaire_id: posteSecondaireId,
      actif,
      langue,
    };

    const { error: profileError } = await supabase.from('profiles').insert(profilePayload);
    if (profileError) throw profileError;

    if (departementIds.length > 0) {
      const rows = departementIds.map((departementId) => ({
        profile_id: createdUser.user.id,
        entreprise_id: entrepriseId,
        departement_id: departementId,
        est_principal: false,
      }));
      const { error: deptError } = await supabase.from('employe_departements').insert(rows);
      if (deptError) throw deptError;
    }

    return corsResponse({
      success: true,
      user_id: createdUser.user.id,
      email,
      temp_password: generatedPassword,
      role: requestedRole,
    }, 200);
  } catch (error) {
    await supabase.auth.admin.deleteUser(createdUser.user.id);
    return corsResponse({ success: false, error: error instanceof Error ? error.message : 'profile_create_failed' }, 500);
  }
});
