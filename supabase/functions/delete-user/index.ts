import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsonResponse, readJsonBody } from '../_shared/http.ts';
import { isProtectedSuperAdmin } from '../_shared/user_admin.ts';

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
    .select('id, entreprise_id, role, is_super_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) throw new Error('caller_profile_missing');
  return data;
}

async function safeDelete(supabase: ReturnType<typeof createClient>, table: string, column: string, value: string) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw error;
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

  const body = await readJsonBody(req);
  if (!body) return corsResponse({ success: false, error: 'invalid_json' }, 400);

  const userId = String(body.user_id ?? '').trim();
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

  const deleteTables: Array<[string, string]> = [
    ['credentials_temporaires', 'profile_id'],
    ['credentials_temporaires', 'user_id'],
    ['employe_departements', 'profile_id'],
    ['pointages', 'profile_id'],
    ['conges', 'employe_id'],
    ['conges', 'validateur_id'],
    ['soldes_conges', 'employe_id'],
    ['messages', 'expediteur_id'],
    ['messages', 'destinataire_id'],
    ['rappels', 'cree_par'],
    ['rappels', 'assigne_a'],
    ['taches', 'assigne_a'],
    ['taches', 'cree_par'],
    ['handovers', 'profile_id'],
    ['feed_likes', 'profile_id'],
    ['feed_items', 'profile_id'],
    ['maintenance_tickets', 'profile_id'],
  ];

  try {
    for (const [table, column] of deleteTables) {
      await safeDelete(supabase, table, column, userId);
    }

    const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileDeleteError) throw profileDeleteError;

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;

    return corsResponse({ success: true, user_id: userId, entreprise_id: target.entreprise_id }, 200);
  } catch (error) {
    return corsResponse({ success: false, error: error instanceof Error ? error.message : 'delete_failed' }, 500);
  }
});
