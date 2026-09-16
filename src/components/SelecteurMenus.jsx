import React from 'react'
import { SOCLE_MENUS } from '../lib/modules'
import { getModuleById } from '../modules/registry'
import { useModules } from '../hooks/useModules'

/**
 * Choix des onglets visibles par une personne.
 *
 * Liste blanche : rien de coche = aucune restriction, la personne voit ce
 * que son role et les modules de l'entreprise lui donnent. Des qu'une case
 * est cochee, seuls les onglets coches lui restent.
 *
 * Le catalogue propose le socle plus les modules REELLEMENT actifs pour
 * l'entreprise. Cocher ne donne jamais acces a autre chose : la liste est
 * appliquee en filtrant la navigation deja calculee (voir src/lib/menus.js).
 *
 * Partage entre la creation d'employe, la modification d'un employe
 * existant et le formulaire du Super Admin, pour que les trois proposent
 * exactement les memes choix.
 */
export default function SelecteurMenus({ valeur = [], onChange, compact = false, moduleIds = null }) {
  // Le Super Admin cree l'employe d'une AUTRE entreprise que celle de son
  // contexte : il passe alors la liste des modules explicitement. Le hook
  // reste appele -- il ne peut pas etre conditionnel -- mais son resultat
  // est ignore dans ce cas.
  const { getActiveModuleIds } = useModules()
  const idsModules = Array.isArray(moduleIds) ? moduleIds : getActiveModuleIds()

  const options = [
    ...SOCLE_MENUS.map(m => ({ id: m.id, label: m.label || m.nom })),
    ...idsModules
      .map(id => getModuleById(id))
      .filter(Boolean)
      .map(m => ({ id: m.id, label: m.nom })),
  ].filter((m, i, tous) => tous.findIndex(x => x.id === m.id) === i)

  const basculer = (id) => {
    onChange(valeur.includes(id) ? valeur.filter(m => m !== id) : [...valeur, id])
  }

  return (
    <div>
      {!compact && (
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
          Onglets visibles
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', lineHeight: 1.5 }}>
        {valeur.length === 0
          ? 'Aucune coche : la personne voit tout ce que son role et votre offre autorisent.'
          : 'Seuls les ' + valeur.length + ' onglet(s) coche(s) lui seront visibles.'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
        {options.map(m => {
          const choisi = valeur.includes(m.id)
          return (
            <label key={m.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer',
              fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: '999px',
              border: '1px solid ' + (choisi ? '#6366f1' : '#e5e7eb'),
              background: choisi ? '#eef2ff' : '#fff',
              color: choisi ? '#3730a3' : '#6b7280',
            }}>
              <input type="checkbox" checked={choisi} onChange={() => basculer(m.id)} style={{ margin: 0 }} />
              {m.label}
            </label>
          )
        })}
      </div>
      {valeur.length > 0 && (
        <button type="button" onClick={() => onChange([])}
          style={{ marginTop: '0.5rem', border: 'none', background: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>
          Tout rendre visible
        </button>
      )}
    </div>
  )
}
