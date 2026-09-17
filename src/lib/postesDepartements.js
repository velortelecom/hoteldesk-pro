// src/lib/postesDepartements.js
// =====================================================================
// Rapprocher le poste et le departement.
//
// LE PROBLEME
// Un poste SAIT a quel departement il appartient (postes.departement_id),
// mais la fiche employe presentait deux listes independantes : un menu de
// 30 metiers a plat, et 27 cases a cocher. Rien ne reliait les deux, rien
// ne verifiait la coherence. On obtenait une gouvernante rattachee a
// l'Accueil -- valide pour la base, absurde pour l'hotel.
//
// Et la consequence n'etait pas cosmetique : la visibilite des taches ne
// regarde QUE les departements coches. Une tache envoyee aux Etages ne
// parvenait jamais a la gouvernante.
//
// CE QUE FAIT CE FICHIER
//   grouperPostesParDepartement : la liste des postes rangee par equipe,
//     pour qu'on voie le rattachement au moment de choisir.
//   departementsApresChoixPoste : choisir un poste coche son departement.
//
// On AJOUTE, on ne remplace jamais : quelqu'un peut appartenir a deux
// equipes, et changer de poste ne doit pas effacer un rattachement pose a
// la main.
// =====================================================================

export const SANS_DEPARTEMENT = '__sans_departement__'

// [{ id, nom, postes: [...] }] -- les departements dans l'ordre recu,
// puis les postes orphelins en dernier. Un departement sans poste ne
// figure pas : ce serait un titre vide dans un menu.
export function grouperPostesParDepartement(postes, departements) {
  const listePostes = Array.isArray(postes) ? postes : []
  const listeDepts = Array.isArray(departements) ? departements : []

  const groupes = []
  const index = {}

  listeDepts.forEach((d) => {
    if (!d || !d.id) return
    const groupe = { id: d.id, nom: d.nom || 'Departement', postes: [] }
    index[d.id] = groupe
    groupes.push(groupe)
  })

  const orphelins = { id: SANS_DEPARTEMENT, nom: 'Sans departement', postes: [] }

  listePostes.forEach((p) => {
    if (!p || !p.id) return
    const groupe = (p.departement_id && index[p.departement_id]) ? index[p.departement_id] : orphelins
    groupe.postes.push(p)
  })

  const resultat = groupes.filter(g => g.postes.length > 0)
  if (orphelins.postes.length > 0) resultat.push(orphelins)
  return resultat
}

// Le departement du poste choisi vient s'ajouter a la selection.
// Rend le TABLEAU D'ORIGINE si rien ne change, pour ne pas declencher de
// rendu inutile.
export function departementsApresChoixPoste(selection, posteId, postes) {
  const actuels = Array.isArray(selection) ? selection : []
  if (!posteId) return actuels

  const poste = (Array.isArray(postes) ? postes : []).find(p => p && p.id === posteId)
  const deptId = poste && poste.departement_id
  if (!deptId) return actuels
  if (actuels.indexOf(deptId) !== -1) return actuels

  return actuels.concat([deptId])
}

// Le poste et les departements se contredisent-ils ? Sert a afficher un
// avertissement, jamais a bloquer : c'est peut-etre volontaire.
export function posteHorsDepartements(posteId, selection, postes) {
  const actuels = Array.isArray(selection) ? selection : []
  if (!posteId || actuels.length === 0) return null

  const poste = (Array.isArray(postes) ? postes : []).find(p => p && p.id === posteId)
  const deptId = poste && poste.departement_id
  if (!deptId) return null
  if (actuels.indexOf(deptId) !== -1) return null

  return deptId
}
