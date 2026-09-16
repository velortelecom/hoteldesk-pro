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

export const PLAN_1_ID = 'starter';
export const PLAN_1_LABEL = 'Pack Starter';
export const PLAN_1_PRIX_MENSUEL = 29;
export const PLAN_1_MAX_UTILISATEURS = 10;
export const PLAN_1_MODULES: readonly string[] = ['organisation', 'conges'];
export const PLAN_1_ROLE_ADMIN = 'admin';

// --- Anti-abus de l'inscription publique -----------------------------
export const ANTI_ABUS = {
  /** Inscriptions abouties autorisees depuis une meme IP sur 24 h. */
  maxSuccesParIp24h: 3,
  /** Tentatives (succes ou echec) autorisees depuis une meme IP sur 1 h. */
  maxTentativesParIp1h: 10,
  /** Tentatives autorisees pour une meme adresse email sur 1 h. */
  maxTentativesParEmail1h: 5,
} as const;
