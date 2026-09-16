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
//     OU elle n'est assignee a PERSONNE et alors :
//         elle vise un departement dont je fais partie
//         OU elle ne vise aucun departement (tache d'entreprise)
//
// Consequence voulue : assignee a quelqu'un, elle n'est visible que par
// lui. Assignee a un departement, par tous ses membres.
//
// UN DESTINATAIRE FERME LA PORTE
//   Une tache a la fois assignee a une personne ET portant un departement
//   n'appartient qu'a cette personne : le departement ne l'elargit pas.
//   C'est la regle demandee -- "si je l'assigne a une personne, il n'y a
//   que cette personne qui la voit" -- et elle prime sur le departement.
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

  // Un destinataire designe : la tache n'est qu'a lui. On s'arrete la,
  // meme si un departement est renseigne par ailleurs.
  if (tache.assigne_a) return false

  const departement = tache.departement || null

  // Ni destinataire ni departement : tache de l'entreprise, visible par tous.
  if (!departement) return true

  const miens = Array.isArray(lecteur.codesDepartements) ? lecteur.codesDepartements : []
  return miens.indexOf(departement) !== -1
}

export function filtrerTachesVisibles(taches, lecteur) {
  if (!Array.isArray(taches)) return []
  return taches.filter(t => tacheVisiblePar(t, lecteur))
}
