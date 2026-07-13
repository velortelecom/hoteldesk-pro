import { createClient } from 'npm:@supabase/supabase-js@2';
import { readJsonBody } from '../_shared/http.ts';
import { recordAuditEvent } from '../_shared/audit.ts';
import { generateTempPassword } from '../_shared/user_admin.ts';

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

function normalizeSlug(value: string) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function toErrorCode(error: unknown) {
  const raw = String((error as { message?: string })?.message || error || '').toLowerCase();

  if (raw.includes('entreprise_slug_exists') || raw.includes('duplicate key') || raw.includes('entreprises_slug_unique')) return 'entreprise_slug_exists';
  if (raw.includes('entreprise_name_exists')) return 'entreprise_name_exists';
  if (raw.includes('missing_nom')) return 'missing_nom';
  if (raw.includes('forbidden')) return 'forbidden';
  if (raw.includes('authentication_required') || raw.includes('invalid_token')) return 'authentication_required';
  if (raw.includes('admin_create_failed')) return 'admin_create_failed';
  if (raw.includes('admin_profile_create_failed')) return 'admin_profile_create_failed';
  if (raw.includes('admin_email_already_exists')) return 'admin_email_already_exists';

  return 'enterprise_create_failed';
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

  const entrepriseInput = payload.entreprise || {};
  const nom = String(entrepriseInput.nom ?? '').trim();
  const slug = normalizeSlug(String(entrepriseInput.slug ?? nom));
  const secteur = String(entrepriseInput.secteur ?? 'hotel').trim() || 'hotel';
  const plan = String(entrepriseInput.plan ?? 'starter').trim() || 'starter';
  const actif = entrepriseInput.actif !== false;
  const prixMensuel = Number(entrepriseInput.prix_mensuel ?? 0);
  const maxUtilisateurs = Number(entrepriseInput.max_utilisateurs ?? 0);
  const emailContact = entrepriseInput.email_contact ? String(entrepriseInput.email_contact).trim() : null;
  const telephone = entrepriseInput.telephone ? String(entrepriseInput.telephone).trim() : null;
  const adresse = entrepriseInput.adresse ? String(entrepriseInput.adresse).trim() : null;

  const modulesSelectionnes = Array.isArray(payload.modules_selectionnes)
    ? payload.modules_selectionnes.filter((v: unknown) => typeof v === 'string' && v.trim()).map((v: string) => v.trim())
    : [];

  const departementsSelectionnes = Array.isArray(payload.departements_selectionnes)
    ? payload.departements_selectionnes
      .filter((v: unknown) => typeof v === 'object' || typeof v === 'string')
      .map((row: unknown) => {
        if (typeof row === 'string') {
          const code = row.trim();
          return { code, nom: code.replace(/_/g, ' '), couleur: '#6B7280' };
        }
        const record = row as Record<string, unknown>;
        return {
          code: String(record.code ?? '').trim(),
          nom: String(record.nom ?? '').trim(),
          couleur: String(record.couleur ?? '#6B7280').trim() || '#6B7280',
        };
      })
      .filter((row: { code: string }) => Boolean(row.code))
    : [];

  const postesSelectionnes = Array.isArray(payload.postes_selectionnes)
    ? payload.postes_selectionnes
      .filter((v: unknown) => typeof v === 'object' && v !== null)
      .map((row: Record<string, unknown>) => ({
        slug: String(row.slug ?? '').trim(),
        nom: String(row.nom ?? '').trim(),
        dept: String(row.dept ?? '').trim(),
        niveau: Number(row.niveau ?? 3) || 3,
        selectionne: row.selectionne === true,
      }))
      .filter((row: { slug: string }) => Boolean(row.slug))
    : [];

  const adminInput = payload.admin && typeof payload.admin === 'object' ? payload.admin as Record<string, unknown> : null;
  const adminEmail = adminInput?.email ? String(adminInput.email).trim().toLowerCase() : null;
  const adminPrenom = adminInput?.prenom ? String(adminInput.prenom).trim() : 'Admin';
  const adminNom = adminInput?.nom ? String(adminInput.nom).trim() : nom;
  const adminTelephone = adminInput?.telephone ? String(adminInput.telephone).trim() : null;

  if (!nom) return corsResponse({ success: false, error: 'missing_nom' }, 400);
  if (!slug) return corsResponse({ success: false, error: 'invalid_slug' }, 400);

  const { data: callerProfile, error: callerProfileError } = await supabase
    .from('profiles')
    .select('id, is_super_admin, entreprise_id, role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (callerProfileError || !callerProfile?.is_super_admin) {
    return corsResponse({ success: false, error: 'forbidden' }, 403);
  }

  let adminUserId: string | null = null;
  let adminPassword: string | null = null;

  try {
    if (adminEmail) {
      const { data: existingByEmail } = await supabase.auth.admin.getUserByEmail(adminEmail);
      if (existingByEmail?.user) {
        return corsResponse({ success: false, error: 'admin_email_already_exists' }, 409);
      }

      adminPassword = generateTempPassword(16);
      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          prenom: adminPrenom,
          nom: adminNom,
          role: 'admin',
        },
      });

      if (createUserError || !createdUser.user?.id) {
        return corsResponse({ success: false, error: 'admin_create_failed' }, 400);
      }

      adminUserId = createdUser.user.id;
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('super_admin_create_entreprise_atomic', {
      p_caller_id: callerProfile.id,
      p_nom: nom,
      p_slug: slug,
      p_secteur: secteur,
      p_plan: plan,
      p_actif: actif,
      p_prix_mensuel: prixMensuel,
      p_max_utilisateurs: maxUtilisateurs,
      p_email_contact: emailContact,
      p_telephone: telephone,
      p_adresse: adresse,
      p_modules: modulesSelectionnes,
      p_departements: departementsSelectionnes,
      p_postes: postesSelectionnes,
      p_admin_user_id: adminUserId,
      p_admin_email: adminEmail,
      p_admin_prenom: adminPrenom,
      p_admin_nom: adminNom,
      p_admin_telephone: adminTelephone,
    });

    if (rpcError) {
      if (adminUserId) await supabase.auth.admin.deleteUser(adminUserId);
      const code = toErrorCode(rpcError);
      const status = code === 'entreprise_slug_exists' || code === 'entreprise_name_exists' ? 409 : 400;
      return corsResponse({ success: false, error: code }, status);
    }

    const result = (rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData))
      ? rpcData as Record<string, unknown>
      : {};

    const entrepriseId = String(result.entreprise_id || '').trim();
    if (!entrepriseId) {
      if (adminUserId) await supabase.auth.admin.deleteUser(adminUserId);
      return corsResponse({ success: false, error: 'enterprise_create_failed' }, 500);
    }

    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('*')
      .eq('id', entrepriseId)
      .maybeSingle();

    const { data: health } = await supabase.rpc('super_admin_platform_health');
    const healthRow = Array.isArray(health) ? (health[0] || null) : (health || null);

    await recordAuditEvent(supabase, {
      acteur_profile_id: callerProfile.id,
      acteur_email: userData.user.email,
      entreprise_id: entrepriseId,
      action: 'creation_entreprise',
      type_cible: 'entreprise',
      cible_id: entrepriseId,
      description: 'Creation entreprise atomique',
      metadonnees: {
        plan,
        secteur,
        admin_created: Boolean(adminUserId),
      },
      adresse_ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      user_agent: req.headers.get('user-agent'),
    });

    return corsResponse({
      success: true,
      entreprise: entreprise || { id: entrepriseId, nom, slug },
      health: healthRow,
      admin: adminUserId
        ? {
            email: adminEmail,
            temp_password: adminPassword,
            user_id: adminUserId,
          }
        : null,
    });
  } catch (error) {
    if (adminUserId) {
      await supabase.auth.admin.deleteUser(adminUserId);
    }
    return corsResponse({ success: false, error: toErrorCode(error) }, 500);
  }
});
