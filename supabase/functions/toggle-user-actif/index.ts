import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsonResponse, readJsonBody } from '../_shared/http.ts';
import { recordAuditEvent } from '../_shared/audit.ts';
import { isProtectedSuperAdmin } from '../_shared/user_admin.ts';

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

async function getCallerProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, entreprise_id, role, is_super_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) throw new Error('caller_profile_missing');
  return data;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  function corsResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
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

  const body = await readJsonBody(req);
  if (!body) return corsResponse({ success: false, error: 'invalid_json' }, 400);

  const userId = String(body.user_id ?? '').trim();
  const actif = body.actif !== false;
  if (!userId) return corsResponse({ success: false, error: 'missing_user_id' }, 400);

  const caller = await getCallerProfile(supabase, userData.user.id);
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, entreprise_id, is_super_admin')
    .eq('id', userId)
    .maybeSingle();

  if (targetError || !target) return corsResponse({ success: false, error: 'target_profile_missing' }, 404);
  if (isProtectedSuperAdmin(target.id)) return corsResponse({ success: false, error: 'protected_super_admin' }, 403);

  const callerIsSuperAdmin = caller.is_super_admin === true;
  const sameEnterprise = caller.entreprise_id && caller.entreprise_id === target.entreprise_id;
  if (!callerIsSuperAdmin && !(['admin', 'responsable'].includes(caller.role) && sameEnterprise)) {
    return corsResponse({ success: false, error: 'forbidden' }, 403);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ actif })
    .eq('id', userId)
    .select('id, actif, entreprise_id')
    .single();

  if (error || !data) return corsResponse({ success: false, error: error?.message || 'update_failed' }, 500);

  await recordAuditEvent(supabase, {
    acteur_profile_id: caller.id,
    acteur_email: userData.user.email,
    entreprise_id: data.entreprise_id,
    action: actif ? 'activation_utilisateur' : 'desactivation_utilisateur',
    type_cible: 'profile',
    cible_id: userId,
    description: actif ? 'Activation utilisateur' : 'Désactivation utilisateur',
    metadonnees: {},
    adresse_ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    user_agent: req.headers.get('user-agent'),
  });

  return corsResponse({ success: true, user_id: userId, actif: data.actif, entreprise_id: data.entreprise_id }, 200);
});
