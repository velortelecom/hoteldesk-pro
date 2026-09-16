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
  const prenom = String(body.prenom ?? '').trim();
  const nom = String(body.nom ?? '').trim();

  if (!userId || !prenom || !nom) {
    return corsResponse(req, { success: false, error: 'missing_required_fields' }, 400);
  }

  const caller = await getCallerProfile(supabase, userData.user.id);
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, entreprise_id, prenom, nom, is_super_admin')
    .eq('id', userId)
    .maybeSingle();

  if (targetError || !target) return corsResponse(req, { success: false, error: 'target_profile_missing' }, 404);
  if (isProtectedSuperAdmin(target.id)) return corsResponse(req, { success: false, error: 'protected_super_admin' }, 403);

  const callerIsSuperAdmin = caller.is_super_admin === true;
  const sameEnterprise = caller.entreprise_id && caller.entreprise_id === target.entreprise_id;
  if (!callerIsSuperAdmin && !(['admin', 'responsable'].includes(caller.role) && sameEnterprise)) {
    return corsResponse(req, { success: false, error: 'forbidden' }, 403);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ prenom, nom })
    .eq('id', userId)
    .select('id, prenom, nom, entreprise_id')
    .single();

  if (error || !data) return corsResponse(req, { success: false, error: error?.message || 'update_failed' }, 500);

  await recordAuditEvent(supabase, {
    acteur_profile_id: caller.id,
    acteur_email: userData.user.email,
    entreprise_id: data.entreprise_id,
    action: 'modification_utilisateur',
    type_cible: 'profile',
    cible_id: userId,
    description: 'Modification utilisateur',
    metadonnees: { prenom, nom },
    adresse_ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    user_agent: req.headers.get('user-agent'),
  });

  return corsResponse(req, { success: true, user_id: data.id, prenom: data.prenom, nom: data.nom, entreprise_id: data.entreprise_id }, 200);
});
