// src/lib/resumeVisibilite.js
// =====================================================================
// Dire, au moment de creer une tache, qui la verra.
//
// La regle est simple mais elle se joue entre DEUX champs qu'on remplit a
// des moments differents : le departement et le destinataire. Personne ne
// devrait avoir a la reconstituer de tete.
//
//   un destinataire        -> lui seul
//   un departement seul    -> tous ses membres
//   ni l'un ni l'autre     -> toute l'entreprise
//
// Le cas qui trompe tout le monde est le troisieme : une tache portant un
// departement ET un destinataire n'appartient qu'au destinataire. On le
// dit explicitement plutot que de laisser croire que le departement
// l'elargit.
//
// Cette phrase reprend mot pour mot ce que fait src/lib/visibiliteTaches.js.
// Si l'une change, l'autre doit changer.
// =====================================================================

export function resumeVisibiliteTache({ departement, assigneA, employes, departements, moiId }) {
  const gens = Array.isArray(employes) ? employes : []
  const equipes = Array.isArray(departements) ? departements : []

  if (assigneA) {
    const p = gens.find(e => e && e.id === assigneA)
    const nom = assigneA === moiId
      ? 'vous'
      : (p ? [p.prenom, p.nom].filter(Boolean).join(' ').trim() || 'la personne choisie' : 'la personne choisie')

    return {
      portee: 'personne',
      texte: departement
        ? 'Visible par ' + nom + ' uniquement — le departement ne l elargit pas.'
        : 'Visible par ' + nom + ' uniquement.',
    }
  }

  if (departement) {
    const d = equipes.find(x => x && x.code === departement)
    return {
      portee: 'departement',
      texte: 'Visible par tous les membres de ' + ((d && d.nom) || departement) + '.',
    }
  }

  return { portee: 'entreprise', texte: 'Visible par toute l entreprise.' }
}
