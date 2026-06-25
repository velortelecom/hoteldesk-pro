// src/modules/_squelette.jsx
// COMPOSANT SQUELETTE GENERIQUE - Reutilise par tous les modules non encore developpes
// Quand un module est developpe (V5+), son dossier remplace ce squelette
// par son propre composant complet.
//
// Usage dans un dossier module :
//   export { default } from '../_squelette.jsx'
//   // + passer moduleId au composant via le registre

import { getModuleById } from './registry.js'

// Icone emoji par code icone
const EMOJI = {
  'calendar-off': '🏖', 'map-pin': '📍', 'file-text': '📄', 'car': '🚗',
  'cpu': '🤖', 'package': '📦', 'receipt': '🧾', 'calendar-check': '📆',
  'users': '🤝', 'check-square': '✅', 'graduation-cap': '🎓', 'shield': '🛡',
  'bar-chart': '📊', 'layout': '🗂', 'git-branch': '🔀', 'code': '💻',
  'palette': '🎨', 'puzzle': '🧩',
}

// Composant squelette generique
// Props : moduleId (string) + permissions (object optionnel)
export default function ModuleSquelette({ moduleId, permissions }) {
  const mod = moduleId ? getModuleById(moduleId) : null
  const icone = mod ? (EMOJI[mod.iconeLib] || '🧩') : '🧩'
  const nom = mod?.nom || moduleId || 'Module'
  const description = mod?.description || ''

  return (
    <div style={{ padding: 40, maxWidth: 700, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{icone}</div>

      <div style={{
        display: 'inline-block', background: '#ECFDF5', color: '#065F46',
        border: '1px solid #6EE7B7', borderRadius: 20, padding: '4px 14px',
        fontSize: 12, fontWeight: 700, marginBottom: 16,
      }}>
        MODULE ACTIF — v0.1.0
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', marginBottom: 10 }}>
        {nom}
      </h1>

      {description && (
        <p style={{ fontSize: 15, color: '#6B7280', marginBottom: 28, lineHeight: 1.6, maxWidth: 420, margin: '0 auto 28px' }}>
          {description}
        </p>
      )}

      <div style={{
        background: '#FEF3C7', border: '1px solid #FCD34D',
        borderRadius: 12, padding: '20px 28px', marginBottom: 24,
      }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🚧</div>
        <p style={{ fontSize: 14, color: '#92400E', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
          Ce module est active dans votre abonnement
          <br />mais n'est pas encore disponible.
        </p>
        <p style={{ fontSize: 13, color: '#B45309', margin: '8px 0 0', lineHeight: 1.4 }}>
          Il sera deploye prochainement.
          Votre abonnement est bien pris en compte.
        </p>
      </div>

      {mod && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
          v{mod.version} — {mod.categorie}
          {mod.badge && <span style={{ marginLeft: 8, background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '2px 6px', fontWeight: 700 }}>{mod.badge}</span>}
        </div>
      )}
    </div>
  )
}

// Factory : cree un composant squelette pre-configure pour un module specifique
// Utilisation dans les dossiers modules :
//   import { createModuleSquelette } from '../_squelette.jsx'
//   export default createModuleSquelette('conges')
export function createModuleSquelette(moduleId) {
  return function Module(props) {
    return <ModuleSquelette moduleId={moduleId} {...props} />
  }
}
