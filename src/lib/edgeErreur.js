// src/lib/edgeErreur.js
// =====================================================================
// Lire ce que dit vraiment une Edge Function quand elle echoue.
//
// supabase.functions.invoke() rend une erreur dont le message est
// toujours le meme : "Edge Function returned a non-2xx status code".
// Le motif reel -- forbidden, target_profile_missing, une erreur SQL --
// est dans le CORPS de la reponse, accessible via error.context, et
// personne ne le lisait. Resultat : une boite d'alerte qui ne dit rien.
//
// Nos fonctions repondent toutes { success: false, error: "..." }.
// =====================================================================

const EXPLICATIONS = {
  forbidden: "Vous n'avez pas le droit de faire cette action sur cette personne.",
  protected_super_admin: 'Ce compte Super Admin est protege et ne peut pas etre supprime.',
  target_profile_missing: "Ce compte n'existe plus en base. Rafraichissez la page.",
  caller_profile_missing: 'Votre propre profil est introuvable. Reconnectez-vous.',
  invalid_token: 'Session expiree. Reconnectez-vous.',
  missing_token: 'Session expiree. Reconnectez-vous.',
  server_misconfigured: 'La fonction serveur est mal configuree (cle manquante).',
  method_not_allowed: 'Appel refuse par le serveur.',
  invalid_json: 'Requete mal formee.',
}

export async function messageErreurEdge(error, secours = 'Action impossible.') {
  if (!error) return secours

  // Le corps de la reponse, quand l'erreur vient d'un statut non-2xx.
  try {
    if (error.context && typeof error.context.json === 'function') {
      const corps = await error.context.clone().json()
      const code = corps && corps.error
      if (code) return (EXPLICATIONS[code] || code) + ' (' + code + ')'
    }
  } catch (e) { /* corps illisible : on passe au repli */ }

  try {
    if (error.context && typeof error.context.text === 'function') {
      const texte = await error.context.clone().text()
      if (texte) return texte.slice(0, 300)
    }
  } catch (e) { /* idem */ }

  return error.message || secours
}
