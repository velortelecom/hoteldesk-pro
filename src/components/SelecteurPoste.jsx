// src/components/SelecteurPoste.jsx
// =====================================================================
// Le menu des postes, range par departement.
//
// A plat, trente metiers ne disent rien de l'organisation : on ne voit
// pas qu'une gouvernante releve des Etages et une receptionniste de
// l'Accueil. Groupes, le rattachement se lit au moment de choisir.
//
// Meme composant pour la creation et pour la fiche, sinon les deux
// divergent et le probleme ne serait corrige qu'a moitie.
// =====================================================================
import React from 'react'
import { grouperPostesParDepartement } from '../lib/postesDepartements'

export default function SelecteurPoste({ valeur, onChange, postes, departements, style, vide = '— Aucun —' }) {
  const groupes = grouperPostesParDepartement(postes, departements)

  return (
    <select value={valeur || ''} onChange={e => onChange(e.target.value)} style={style}>
      <option value="">{vide}</option>
      {groupes.map(groupe => (
        <optgroup key={groupe.id} label={groupe.nom}>
          {groupe.postes.map(p => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
