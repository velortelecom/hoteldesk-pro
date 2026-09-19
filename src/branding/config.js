// src/branding/config.js
// =====================================================================
// CONFIGURATION CENTRALISEE DU BRANDING
//
// POURQUOI CE FICHIER A ETE REPRIS
//   APP_URL valait 'https://app.velorone.app' et SUPPORT_EMAIL
//   'support@velorone.app'. Ni app.velorone.app ni velorone.app ne
//   resolvent : les deux domaines n'existent pas encore.
//
//   Ce n'etait pas cosmetique. SuperAdmin.jsx affiche APP_URL sur la
//   carte remise au client a la creation d'un compte, avec son e-mail et
//   son mot de passe provisoire. Chaque personne a qui un acces a ete
//   donne a donc recu une adresse qui n'ouvre rien -- et le premier
//   geste d'un nouvel utilisateur, c'est de cliquer dessus. Une adresse
//   morte au tout premier contact coute plus cher qu'un joli domaine
//   n'en rapporte.
//
//   Meme raisonnement pour le support : une adresse qui ne recoit pas de
//   courrier est pire que pas d'adresse du tout. Celui qui ecrit croit
//   avoir demande de l'aide.
//
// LA REGLE RETENUE
//   On n'affiche que des adresses qui FONCTIONNENT aujourd'hui, et on
//   rend l'URL configurable pour le jour ou le vrai domaine existera :
//   il suffira alors d'ajouter la variable dans Vercel, sans toucher au
//   code ni refaire un deploiement de correction.
// =====================================================================

export const APP_NAME = 'Velor One';
export const APP_SHORT_NAME = 'Velor One';
export const APP_INITIALS = 'VO';

/**
 * L'adresse que l'on donne aux utilisateurs.
 *
 * Le defaut est l'adresse reellement en ligne. Le jour ou le domaine
 * definitif est achete et branche sur Vercel, on ajoute la variable
 * REACT_APP_APP_URL dans les reglages du projet Vercel et on redeploie
 * -- rien a modifier ici.
 *
 * Variables CRA : lues au BUILD, pas a l'execution. Une valeur vide ou
 * absente retombe donc sur le defaut, ce qui est le comportement voulu.
 */
export const APP_URL = (process.env.REACT_APP_APP_URL || '').trim()
  || 'https://hoteldesk-pro.vercel.app';

/** Une adresse qui recoit vraiment du courrier. */
export const SUPPORT_EMAIL = (process.env.REACT_APP_SUPPORT_EMAIL || '').trim()
  || 'velor.telecom@gmail.com';

/**
 * Le site vitrine.
 *
 * velorone.app ne resout pas non plus. Tant qu'il n'existe pas, WEBSITE
 * pointe sur l'application elle-meme plutot que sur un lien mort.
 */
export const WEBSITE = (process.env.REACT_APP_WEBSITE || '').trim() || APP_URL;

export const PRIMARY_COLOR = '#0F172A';
export const SECONDARY_COLOR = '#2563EB';
export const ACCENT_COLOR = '#38BDF8';

const BRANDING = { APP_NAME, APP_SHORT_NAME, APP_INITIALS, APP_URL, SUPPORT_EMAIL, WEBSITE, PRIMARY_COLOR, SECONDARY_COLOR, ACCENT_COLOR };
export default BRANDING;
