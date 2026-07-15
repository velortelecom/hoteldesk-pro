import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsonResponse, readJsonBody } from '../_shared/http.ts';
import { recordAuditEvent } from '../_shared/audit.ts';
import { ALLOWED_ROLES, buildFallbackEmail, canGrantRole, generateTempPassword, isAllowedRole } from '../_shared/user_admin.ts';

function isAllowedOrigin(origin: string, allowlist: string[]) {
  if (!origin) return false;

  for (const entry of allowlist) {
    const item = entry.trim();
    if (!item) continue;
    if (item === '*') return true;
    if (item === origin) return true;
    if (item.startsWith('*.')) {
      const suffix = item.slice(1);
      if (origin.endsWith(suffix)) return true;
    }
  }

  const lower = origin.toLowerCase();
  if (lower.startsWith('https://') && lower.endsWith('.vercel.app')) return true;
  if (lower.startsWith('https://localhost') || lower.startsWith('http://localhost')) return true;
  return false;
}

function buildCorsHeaders(req: Request) {
  const configured = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
  const allowlist = configured.split(',').map((v) => v.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigin = isAllowedOrigin(origin, allowlist)
    ? origin
    : (allowlist[0] || '*');

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function corsResponse(req: Request, body: unknown, status = 200) {
  const corsHeaders = buildCorsHeaders(req);
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

function toCreateUserErrorCode(error: unknown) {
  const raw = String((error as { message?: string; code?: string })?.message || (error as { code?: string })?.code || error || '').toLowerCase();
  if (raw.includes('email_exists') || raw.includes('already been registered')) return 'email_exists';
  return 'auth_create_failed';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: buildCorsHeaders(req) });
  if (req.method !== 'POST') return corsResponse(req, { success: false, error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return corsResponse(req, { success: false, error: 'server_misconfigured' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return corsResponse(req, { success: false, error: 'missing_token' }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user) return corsResponse(req, { success: false, error: 'invalid_token' }, 401);

  const payload = await readJsonBody(req);
  if (!payload) return corsResponse(req, { success: false, error: 'invalid_json' }, 400);

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

  if (!prenom || !nom || !entrepriseId) return corsResponse(req, { success: false, error: 'missing_required_fields' }, 400);
  if (!isAllowedRole(requestedRole)) return corsResponse(req, { success: false, error: 'invalid_role' }, 400);
  if (!userData.user.email) return corsResponse(req, { success: false, error: 'missing_caller_email' }, 401);
  const userAgent = req.headers.get('user-agent');
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;

  const caller = await getCallerProfile(supabase, userData.user.id);
  const isSuperAdmin = caller.is_super_admin === true;
  const allowed = canGrantRole({
    callerIsSuperAdmin: isSuperAdmin,
    callerRole: caller.role,
    callerEntrepriseId: caller.entreprise_id,
    targetEntrepriseId: entrepriseId,
    requestedRole: requestedRole as typeof ALLOWED_ROLES[number],
  });
  if (!allowed) return corsResponse(req, { success: false, error: 'forbidden' }, 403);

  let email = emailInput || buildFallbackEmail(prenom, nom, entrepriseId);
  const generatedPassword = generateTempPassword(16);

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: { prenom, nom, role: requestedRole, entreprise_id: entrepriseId },
  });
  if (createUserError || !createdUser.user) {
    const code = toCreateUserErrorCode(createUserError || 'auth_create_failed');
    if (code === 'email_exists' && emailInput) {
      return corsResponse(req, { success: false, error: 'email_exists' }, 409);
    }

    if (code === 'email_exists' && !emailInput) {
      const localPart = email.split('@')[0];
      email = `${localPart}.${crypto.randomUUID().slice(0, 8)}@velor.local`;
      const retry = await supabase.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { prenom, nom, role: requestedRole, entreprise_id: entrepriseId },
      });
      if (retry.error || !retry.data.user) {
        return corsResponse(req, { success: false, error: retry.error?.message || 'auth_create_failed' }, 400);
      }
      createdUser.user = retry.data.user;
    } else {
      return corsResponse(req, { success: false, error: createUserError?.message || 'auth_create_failed' }, 400);
    }
  }

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

    // Use upsert to handle databases where a trigger auto-creates a minimal profile
    // when auth.users is inserted. Without upsert, the INSERT would fail with a
    // unique-key violation and the rollback would leave an orphaned auth session.
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });
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

    await recordAuditEvent(supabase, {
      acteur_profile_id: caller.id,
      acteur_email: userData.user.email,
      entreprise_id: entrepriseId,
      action: 'creation_utilisateur',
      type_cible: 'profile',
      cible_id: createdUser.user.id,
      description: 'Création utilisateur',
      metadonnees: { role: requestedRole, actif, departement_count: departementIds.length },
      adresse_ip: ipAddress,
      user_agent: userAgent,
    });

    return corsResponse(req, {
      success: true,
      user_id: createdUser.user.id,
      email,
      temp_password: generatedPassword,
      role: requestedRole,
    }, 200);
  } catch (error) {
    await supabase.auth.admin.deleteUser(createdUser.user.id);
    return corsResponse(req, { success: false, error: error instanceof Error ? error.message : 'profile_create_failed' }, 500);
  }
});
