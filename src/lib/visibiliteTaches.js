// src/lib/visibiliteTaches.js
// =====================================================================
// Qui voit quelle tache.
//
// AVANT : un employe voyait toutes les taches de sa CATEGORIE, deduite de
// profiles.departement (une etiquette texte limitee a reception/menage/
// maintenance/restauration/direction). L'assignation ne jouait aucun role,
// et une tache confiee a quelqu'un etait visible par tous ses collegues de
// categorie.
//
// MAINTENANT, une seule regle, valable pour tout le monde sauf les
// administrateurs :
//
//   je vois une tache si
//     elle m'est assignee
//     OU je l'ai creee
//     OU elle vise un departement dont je fais partie
//     OU elle ne vise ni personne ni departement (tache d'entreprise)
//
// Consequence voulue : assignee a quelqu'un, elle n'est visible que par
// lui. Assignee a un departement, par tous ses membres.
//
// Le createur garde toujours la sienne sous les yeux -- sans ca, on confie
// une tache et on la perd de vue.
//
// LES DEPARTEMENTS SONT DES CODES, PAS DES IDENTIFIANTS
//   taches.departement est du TEXTE et correspond a departements.code.
//   L'appartenance d'un employe passe elle par employe_departements, avec
//   des uuid. Le rapprochement se fait donc sur le code, apres traduction
//   (voir src/hooks/useMesDepartements.js).
// =====================================================================

export function tacheVisiblePar(tache, lecteur) {
  if (!tache || !lecteur) return false

  // Un administrateur supervise : il voit tout ce qui se passe chez lui.
  if (lecteur.isSuperAdmin || lecteur.role === 'admin') return true

  if (lecteur.id && tache.assigne_a === lecteur.id) return true
  if (lecteur.id && tache.cree_par === lecteur.id) return true

  const departement = tache.departement || null
  const assignee = tache.assigne_a || null

  if (departement) {
    const miens = Array.isArray(lecteur.codesDepartements) ? lecteur.codesDepartements : []
    if (miens.indexOf(departement) !== -1) return true
    // Visee sur un departement qui n'est pas le mien : pas pour moi, meme
    // si elle n'est assignee a personne.
    return false
  }

  // Ni destinataire ni departement : tache de l'entreprise, visible par tous.
  return !assignee
}

export function filtrerTachesVisibles(taches, lecteur) {
  if (!Array.isArray(taches)) return []
  return taches.filter(t => tacheVisiblePar(t, lecteur))
}
