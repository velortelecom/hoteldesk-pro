// supabase/functions/_shared/plan1.ts
// =====================================================================
// PLAN 1 - definition serveur (miroir de la RPC public_signup_create_entreprise_atomic).
//
// La liste des modules est aussi ecrite en dur dans la RPC SQL : c'est elle
// qui fait foi a l'ecriture. Cette copie sert a la validation et au retour
// d'API. Aucune de ces valeurs ne provient jamais du navigateur.
//
// Contenu arrete le 15/09/2026, limite a ce qui est reellement developpe :
//   - socle complet (Accueil, Planning, Taches, Messages, Rappels, Equipe)
//   - module organisation (v1.0.0)
//   - module conges (v0.1.0)
// Les 16 autres modules du registre sont des squelettes : jamais actives ici.
// =====================================================================

// L'identifiant reste 'starter' : il est ecrit dans entreprises.plan, dans
// la RPC d'inscription et dans le trigger d'essai 14 jours. Seul le nom
// commercial change.
export const PLAN_1_ID = 'starter';
export const PLAN_1_LABEL = 'Velor One';
export const PLAN_1_PRIX_MENSUEL = 39;
export const PLAN_1_MAX_UTILISATEURS = 10;
export const PLAN_1_MODULES: readonly string[] = ['organisation', 'conges', 'pointage'];
export const PLAN_1_ROLE_ADMIN = 'admin';

// --- Utilisateur supplementaire --------------------------------------
// Au-dela du forfait, chaque utilisateur coute ce montant. Remplace le
// plafond dur : un plafond poussait le client a ne PAS creer le compte du
// salarie en trop, ce qui rendait son decompte legal incomplet.
export const PRIX_UTILISATEUR_SUP = 2;
export const PLAFOND_FORFAIT = 30;   // au-dela : devis

// --- Tarif fondateur --------------------------------------------------
// Les PREMIERES entreprises entrent a 29 EUR et gardent ce prix a vie.
// Le comptage se fait en SQL dans la RPC d'inscription : le navigateur ne
// decide jamais d'un prix. Le blocage a vie ne demande aucun mecanisme,
// puisque le prix est fige dans entreprises.prix_mensuel a la creation.
export const TARIF_FONDATEUR = 29;
export const FONDATEURS_MAX = 5;

// --- Plan Gratuit -----------------------------------------------------
// Ajoute le 17/09/2026. Ce n'est PAS le plan de l'inscription publique :
// celle-ci cree toujours un Starter avec 14 jours d'essai. Le plan Gratuit
// est la porte de sortie de l'essai -- au lieu de basculer l'espace en
// lecture seule et de perdre le client, on le laisse travailler a 3
// utilisateurs avec le seul module Organisation.
//
// Consequence a ne pas rater : le trigger set_essai_14j ne pose une date de
// fin QUE sur le plan 'starter'. Une entreprise passee en 'gratuit' n'a donc
// pas de date de fin, et n'expire jamais. C'est voulu.
export const PLAN_GRATUIT_ID = 'gratuit';
export const PLAN_GRATUIT_LABEL = 'Gratuit';
export const PLAN_GRATUIT_PRIX_MENSUEL = 0;
export const PLAN_GRATUIT_MAX_UTILISATEURS = 3;
export const PLAN_GRATUIT_MODULES: readonly string[] = ['organisation'];

// Les options a l'unite ont ete retirees le 17/09/2026 en meme temps que
// les packs : avec DEUX modules livrables, une liste d'options aurait
// annonce quinze choses qui n'existent pas. Elles reviendront quand il y
// aura des modules a vendre.

// --- Anti-abus de l'inscription publique -----------------------------
export const ANTI_ABUS = {
  /** Inscriptions abouties autorisees depuis une meme IP sur 24 h. */
  maxSuccesParIp24h: 3,
  /** Tentatives (succes ou echec) autorisees depuis une meme IP sur 1 h. */
  maxTentativesParIp1h: 10,
  /** Tentatives autorisees pour une meme adresse email sur 1 h. */
  maxTentativesParEmail1h: 5,
} as const;
