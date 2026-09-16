import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, jsonResponse, readJsonBody } from '../_shared/http.ts';
import { recordAuditEvent } from '../_shared/audit.ts';
import { isProtectedSuperAdmin } from '../_shared/user_admin.ts';

// CORS : une seule origine par reponse.
//
// Cette copie locale renvoyait la valeur BRUTE d'ALLOWED_ORIGIN. Or ce
// reglage contient une liste separee par des virgules (une entree par
// domaine et par preview), et un navigateur n'accepte qu'UNE origine dans
// l'en-tete Access-Control-Allow-Origin. Il recevait donc la liste entiere,
// ne reconnaissait rien, et bloquait l'appel avant l'envoi -- une erreur
// reseau cote client, sans que la fonction soit jamais atteinte.
//
// _shared/http.ts choisit la bonne origine dans la liste, en fonction de la
// requete. C'est pour ca qu'il existe, et que create-user marchait pendant
// que celle-ci echouait.
function corsResponse(req: Request, body: unknown, status = 200) {
  return jsonResponse(body, status, req);
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

  const body = await readJsonBody(req);
  if (!body) return corsResponse(req, { success: false, error: 'invalid_json' }, 400);

  const userId = String(body.user_id ?? '').trim();
  if (!userId) return corsResponse(req, { success: false, error: 'missing_user_id' }, 400);

  const caller = await getCallerProfile(supabase, userData.user.id);
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, entreprise_id, is_super_admin')
    .eq('id', userId)
    .maybeSingle();

  if (targetError || !target) return corsResponse(req, { success: false, error: 'target_profile_missing' }, 404);
  if (isProtectedSuperAdmin(target.id)) return corsResponse(req, { success: false, error: 'protected_super_admin' }, 403);

  const callerIsSuperAdmin = caller.is_super_admin === true;
  const sameEnterprise = caller.entreprise_id && caller.entreprise_id === target.entreprise_id;
  if (!callerIsSuperAdmin && !(['admin', 'responsable'].includes(caller.role) && sameEnterprise)) {
    return corsResponse(req, { success: false, error: 'forbidden' }, 403);
  }

  // Tables that may NOT have a cascade FK to profiles — must be cleaned up explicitly
  // BEFORE deleting the auth user.
  // Tables WITH cascade FK to profiles (rappels.cree_par, conges.employe_id,
  // messages.expediteur_id, etc.) are handled automatically by the cascade when
  // the profile row is removed.
  const tablesWithoutCascade: Array<[string, string]> = [
    ['credentials_temporaires', 'profile_id'],
    ['credentials_temporaires', 'user_id'],
    ['employe_departements', 'profile_id'],
    ['soldes_conges', 'employe_id'],
    ['handovers', 'profile_id'],
    ['feed_likes', 'profile_id'],
    ['feed_items', 'profile_id'],
    ['maintenance_tickets', 'profile_id'],
  ];

  try {
    // Step 1: clean tables without cascade FKs
    for (const [table, column] of tablesWithoutCascade) {
      await safeDelete(supabase, table, column, userId);
    }

    // Step 2: delete auth user FIRST.
    // This cascades to profiles (FK ON DELETE CASCADE) which in turn cascades
    // to rappels.cree_par, conges.employe_id, messages.expediteur_id, etc.
    // Deleting auth.users first ensures the user session is immediately
    // invalidated, preventing the "profile gone but session still active" race
    // that would cause rappels_cree_par_fkey violations.
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;

    await recordAuditEvent(supabase, {
      acteur_profile_id: caller.id,
      acteur_email: userData.user.email,
      entreprise_id: target.entreprise_id,
      action: 'suppression_utilisateur',
      type_cible: 'profile',
      cible_id: userId,
      description: 'Suppression utilisateur',
      metadonnees: { protected: false },
      adresse_ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      user_agent: req.headers.get('user-agent'),
    });

    // Step 3: profile is already gone via cascade — skip explicit profile delete
    return corsResponse(req, { success: true, user_id: userId, entreprise_id: target.entreprise_id }, 200);
  } catch (error) {
    return corsResponse(req, { success: false, error: error instanceof Error ? error.message : 'delete_failed' }, 500);
  }
});
