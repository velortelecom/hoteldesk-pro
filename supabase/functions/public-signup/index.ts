// supabase/functions/public-signup/index.ts
// =====================================================================
// VELOR ONE - Inscription publique autonome (PLAN 1 UNIQUEMENT)
//
// Seul point d'entree autorise pour la page publique /inscription.
// Aucune policy RLS n'ouvre l'ecriture au role anon : tout passe ici, en
// service_role, avec validation stricte, anti-abus, audit et rollback.
//
// CE QUE CETTE FONCTION PEUT CREER, ET RIEN D'AUTRE :
//   - 1 entreprise (origine 'inscription_autonome')
//   - 1 site principal
//   - 1 compte Auth + 1 profil role 'admin', is_super_admin = false
//   - les modules de la formule, listes en dur dans la RPC
//   - les departements / postes du template du secteur choisi
//
// LA SEULE CHOSE QUE LE VISITEUR CHOISIT : LE NOM DE SA FORMULE
//   'gratuit' ou 'starter', et rien d'autre. Le prix, les modules et le
//   plafond d'utilisateurs sont ecrits dans la RPC, jamais transmis. Une
//   valeur inconnue retombe sur l'offre PAYANTE : on ne doit pas pouvoir
//   s'offrir un plan en bricolant la requete.
//
//   Le tarif fondateur, lui, n'est decide ni ici ni dans la RPC : le
//   trigger trg_tarif_fondateur compte les places a l'INSERT. Un seul
//   endroit decide du prix.
//
// CE QU'ELLE NE PEUT JAMAIS FAIRE :
//   - creer un super_admin
//   - rejoindre une entreprise existante
//   - activer un module hors formule
//   - fixer un prix ou un plafond d'utilisateurs
//   - ecrire dans modules_catalogue
//
// Le corps de requete ne contient NI role, NI is_super_admin, NI
// entreprise_id, NI liste de modules, NI plan, NI prix : ces champs sont
// ignores meme s'ils sont envoyes (voir CHAMPS_INTERDITS).
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, jsonResponse, readJsonBody } from '../_shared/http.ts';
import { recordAuditEvent } from '../_shared/audit.ts';
import { ANTI_ABUS, PLAN_1_ID, PLAN_1_MODULES, PLAN_GRATUIT_ID } from '../_shared/plan1.ts';
import { getTemplate, SECTEURS_VALIDES } from '../_shared/secteurs_templates.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MDP_MIN = 8;
const MDP_MAX = 72; // limite bcrypt cote GoTrue

/** Champs qu'un navigateur pourrait tenter d'injecter : ignores, et traces. */
const CHAMPS_INTERDITS = [
  'role', 'is_super_admin', 'entreprise_id', 'plan', 'modules',
  'modules_selectionnes', 'prix_mensuel', 'max_utilisateurs', 'origine',
];

type Erreur = { champ: string; message: string };

function texte(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function adresseIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || null;
  return req.headers.get('cf-connecting-ip');
}

function valider(body: Record<string, unknown>) {
  const erreurs: Erreur[] = [];

  const nomEntreprise = texte(body.nom_entreprise);
  const secteur = texte(body.secteur);
  const adminPrenom = texte(body.admin_prenom);
  const adminNom = texte(body.admin_nom);
  const email = texte(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const passwordConfirm = typeof body.password_confirm === 'string' ? body.password_confirm : '';
  const telephone = texte(body.telephone);
  const nbBrut = body.nombre_employes;

  if (nomEntreprise.length < 2) erreurs.push({ champ: 'nom_entreprise', message: "Le nom de l'entreprise est requis (2 caracteres minimum)." });
  else if (nomEntreprise.length > 120) erreurs.push({ champ: 'nom_entreprise', message: "Le nom de l'entreprise est trop long." });

  if (!SECTEURS_VALIDES.includes(secteur)) erreurs.push({ champ: 'secteur', message: 'Choisissez un secteur dans la liste.' });

  if (adminPrenom.length < 2) erreurs.push({ champ: 'admin_prenom', message: 'Le prenom est requis.' });
  else if (adminPrenom.length > 80) erreurs.push({ champ: 'admin_prenom', message: 'Prenom trop long.' });

  if (adminNom.length < 2) erreurs.push({ champ: 'admin_nom', message: 'Le nom est requis.' });
  else if (adminNom.length > 80) erreurs.push({ champ: 'admin_nom', message: 'Nom trop long.' });

  if (!EMAIL_RE.test(email) || email.length > 200) erreurs.push({ champ: 'email', message: 'Adresse email invalide.' });

  if (password.length < MDP_MIN) erreurs.push({ champ: 'password', message: `Le mot de passe doit faire au moins ${MDP_MIN} caracteres.` });
  else if (password.length > MDP_MAX) erreurs.push({ champ: 'password', message: `Le mot de passe ne doit pas depasser ${MDP_MAX} caracteres.` });

  if (password !== passwordConfirm) erreurs.push({ champ: 'password_confirm', message: 'Les mots de passe ne correspondent pas.' });

  if (telephone && telephone.length > 30) erreurs.push({ champ: 'telephone', message: 'Numero de telephone invalide.' });

  let nombreEmployes: number | null = null;
  if (nbBrut !== undefined && nbBrut !== null && nbBrut !== '') {
    const n = Number(nbBrut);
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      erreurs.push({ champ: 'nombre_employes', message: "Nombre d'employes invalide." });
    } else {
      nombreEmployes = n;
    }
  }

  // FORMULE : la seule chose que le navigateur choisit. Ni le prix, ni les
  // modules, ni le plafond d'utilisateurs -- tout cela est ecrit dans la
  // RPC. On se contente donc de verifier que la valeur fait partie de la
  // liste fermee ; n'importe quoi d'autre devient l'offre payante, jamais
  // la gratuite. Un visiteur ne doit pas pouvoir s'offrir un plan en
  // bricolant la requete.
  const formuleBrute = texte(body.formule).toLowerCase();
  const formule = (formuleBrute === PLAN_GRATUIT_ID || formuleBrute === PLAN_1_ID)
    ? formuleBrute
    : PLAN_1_ID;

  return {
    erreurs,
    valeurs: { nomEntreprise, secteur, adminPrenom, adminNom, email, password, telephone: telephone || null, nombreEmployes, formule },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: buildCorsHeaders(req) });
  const rep = (body: unknown, status = 200) => jsonResponse(body, status, req);
  if (req.method !== 'POST') return rep({ success: false, error: 'method_not_allowed', message: 'Methode non autorisee.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return rep({ success: false, error: 'server_misconfigured', message: 'Service indisponible. Reessayez plus tard.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const ip = adresseIp(req);
  const userAgent = req.headers.get('user-agent');

  async function tracerTentative(email: string | null, succes: boolean, motif: string | null) {
    const { error } = await supabase.from('inscriptions_tentatives').insert({
      adresse_ip: ip, email, succes, motif_echec: motif, user_agent: userAgent,
    });
    if (error) console.error('trace_tentative_failed', error.message);
  }

  const payload = await readJsonBody(req);
  if (!payload || typeof payload !== 'object') {
    await tracerTentative(null, false, 'invalid_json');
    return rep({ success: false, error: 'invalid_json', message: 'Requete invalide.' }, 400);
  }

  const body = payload as Record<string, unknown>;

  // Tentative d'injection de champs privilegies : valeurs ignorees de toute
  // facon, mais on la trace dans l'audit.
  const champsInjectes = CHAMPS_INTERDITS.filter((c) => c in body);
  if (champsInjectes.length > 0) {
    console.warn('public-signup: champs privilegies ignores :', champsInjectes.join(', '));
  }

  const { erreurs, valeurs } = valider(body);
  if (erreurs.length > 0) {
    await tracerTentative(valeurs.email || null, false, 'validation');
    return rep({ success: false, error: 'validation_failed', message: 'Certains champs sont invalides.', erreurs }, 400);
  }

  const { nomEntreprise, secteur, adminPrenom, adminNom, email, password, telephone, nombreEmployes, formule } = valeurs;

  // --- Anti-abus -------------------------------------------------------
  const ilYaUneHeure = new Date(Date.now() - 3600_000).toISOString();
  const ilYa24h = new Date(Date.now() - 86_400_000).toISOString();

  if (ip) {
    const { count: succes24h } = await supabase
      .from('inscriptions_tentatives')
      .select('id', { count: 'exact', head: true })
      .eq('adresse_ip', ip).eq('succes', true).gte('created_at', ilYa24h);

    if ((succes24h ?? 0) >= ANTI_ABUS.maxSuccesParIp24h) {
      await tracerTentative(email, false, 'rate_limit_ip_24h');
      return rep({ success: false, error: 'rate_limited', message: "Trop d'inscriptions depuis ce reseau. Contactez Velor One pour creer d'autres espaces." }, 429);
    }

    const { count: tentatives1h } = await supabase
      .from('inscriptions_tentatives')
      .select('id', { count: 'exact', head: true })
      .eq('adresse_ip', ip).gte('created_at', ilYaUneHeure);

    if ((tentatives1h ?? 0) >= ANTI_ABUS.maxTentativesParIp1h) {
      await tracerTentative(email, false, 'rate_limit_ip_1h');
      return rep({ success: false, error: 'rate_limited', message: 'Trop de tentatives. Reessayez dans une heure.' }, 429);
    }
  }

  const { count: tentativesEmail } = await supabase
    .from('inscriptions_tentatives')
    .select('id', { count: 'exact', head: true })
    .eq('email', email).gte('created_at', ilYaUneHeure);

  if ((tentativesEmail ?? 0) >= ANTI_ABUS.maxTentativesParEmail1h) {
    await tracerTentative(email, false, 'rate_limit_email_1h');
    return rep({ success: false, error: 'rate_limited', message: 'Trop de tentatives pour cette adresse. Reessayez dans une heure.' }, 429);
  }

  // --- Email deja utilise ? -------------------------------------------
  const { data: dejaPris, error: errRecherche } = await supabase
    .from('profiles_with_email')
    .select('id')
    .eq('email', email)
    .limit(1);
  if (errRecherche) console.error('verification_email_failed', errRecherche.message);
  if (dejaPris && dejaPris.length > 0) {
    await tracerTentative(email, false, 'email_exists');
    return rep({
      success: false, error: 'email_already_exists',
      message: 'Un compte existe deja avec cette adresse email.',
      erreurs: [{ champ: 'email', message: 'Adresse deja utilisee.' }],
    }, 409);
  }

  // --- Creation ---------------------------------------------------------
  let adminUserId: string | null = null;
  let entrepriseIdCreee: string | null = null;

  try {
    const { data: createdUser, error: errUser } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom: adminPrenom, nom: adminNom },
    });

    if (errUser || !createdUser?.user?.id) {
      const brut = (errUser?.message || '').toLowerCase();
      if (brut.includes('already') || brut.includes('registered')) {
        await tracerTentative(email, false, 'email_exists');
        return rep({
          success: false, error: 'email_already_exists',
          message: 'Un compte existe deja avec cette adresse email.',
          erreurs: [{ champ: 'email', message: 'Adresse deja utilisee.' }],
        }, 409);
      }
      throw new Error('admin_create_failed: ' + (errUser?.message || 'inconnu'));
    }

    adminUserId = createdUser.user.id;

    // Template du secteur : resolu ICI, cote serveur, a partir du seul
    // identifiant de secteur valide. Le client n'envoie aucune structure.
    const template = getTemplate(secteur);
    const departements = template?.departements ?? [];
    const postes = template?.postes ?? [];

    // Une seule transaction SQL : entreprise, site, modules Plan 1,
    // departements, postes, profil admin.
    const { data: rpcData, error: rpcError } = await supabase.rpc('public_signup_create_entreprise_atomic', {
      p_nom: nomEntreprise,
      p_secteur: secteur,
      p_email_contact: email,
      p_telephone: telephone,
      p_nombre_employes: nombreEmployes,
      p_departements: departements,
      p_postes: postes,
      p_admin_user_id: adminUserId,
      p_admin_prenom: adminPrenom,
      p_admin_nom: adminNom,
      p_formule: formule,
    });

    if (rpcError) throw new Error('rpc_failed: ' + rpcError.message);

    const resultat = (rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData))
      ? rpcData as Record<string, unknown>
      : {};
    const entrepriseId = String(resultat.entreprise_id || '').trim();
    if (!entrepriseId) throw new Error('rpc_failed: entreprise_id absent');
    entrepriseIdCreee = entrepriseId;

    // --- Verification de non-regression : aucun module hors Plan 1 ------
    const { data: modulesActifs } = await supabase
      .from('entreprise_modules')
      .select('module_id')
      .eq('entreprise_id', entrepriseId)
      .eq('actif', true);

    const idsActifs = (modulesActifs || []).map((m: { module_id: string }) => m.module_id);
    const horsPlan = idsActifs.filter((id: string) => !PLAN_1_MODULES.includes(id));
    if (horsPlan.length > 0) throw new Error('modules_hors_plan1: ' + horsPlan.join(','));

    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('id, nom, slug, plan, secteur, origine, created_at')
      .eq('id', entrepriseId)
      .maybeSingle();

    await recordAuditEvent(supabase, {
      acteur_profile_id: adminUserId,
      acteur_email: email,
      entreprise_id: entrepriseId,
      action: 'inscription_autonome',
      type_cible: 'entreprise',
      cible_id: entrepriseId,
      description: 'Inscription publique : creation entreprise et premier admin (Plan 1)',
      metadonnees: {
        plan: PLAN_1_ID,
        secteur,
        modules_actives: idsActifs,
        departements_crees: departements.length,
        postes_crees: postes.length,
        champs_ignores: champsInjectes,
      },
      adresse_ip: ip,
      user_agent: userAgent,
    });

    await tracerTentative(email, true, null);

    return rep({
      success: true,
      entreprise: entreprise || { id: entrepriseId, nom: nomEntreprise, plan: PLAN_1_ID },
      admin: { id: adminUserId, email },
      plan: PLAN_1_ID,
      modules_actives: idsActifs,
      departements_crees: departements.length,
      postes_crees: postes.length,
    }, 201);

  } catch (error) {
    // --- ROLLBACK ------------------------------------------------------
    // La RPC est transactionnelle : si elle leve, rien n'est ecrit cote
    // metier. Restent le compte Auth (cree hors transaction) et, si l'echec
    // est survenu APRES la RPC, l'entreprise creee. On supprime les deux.
    // Supprimer l'utilisateur emporte son profil (FK ON DELETE CASCADE) ;
    // supprimer l'entreprise emporte sites, modules, departements, postes.
    const motif = error instanceof Error ? error.message : String(error);
    console.error('public-signup echec, rollback :', motif);

    let rollbackComplet = true;

    if (entrepriseIdCreee) {
      const { error: errEnt } = await supabase.from('entreprises').delete().eq('id', entrepriseIdCreee);
      if (errEnt) {
        rollbackComplet = false;
        console.error('ROLLBACK INCOMPLET - entreprise non supprimee', entrepriseIdCreee, errEnt.message);
      }
    }

    if (adminUserId) {
      const { error: errUser } = await supabase.auth.admin.deleteUser(adminUserId);
      if (errUser) {
        rollbackComplet = false;
        console.error('ROLLBACK INCOMPLET - utilisateur Auth non supprime', adminUserId, errUser.message);
      }
    }

    await tracerTentative(email, false, (rollbackComplet ? '' : 'ROLLBACK_INCOMPLET ') + motif.slice(0, 180));

    // Jamais d'erreur SQL brute dans l'interface.
    return rep({
      success: false,
      error: 'signup_failed',
      message: "La creation de votre espace n'a pas pu aboutir. Aucune donnee n'a ete conservee. Reessayez ou contactez Velor One.",
    }, 500);
  }
});
