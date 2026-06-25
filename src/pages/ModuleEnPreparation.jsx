// src/pages/ModuleEnPreparation.jsx
// Page temporaire pour les modules actives mais pas encore developpes
// Affichee quand le module est dans entreprise_modules (actif=true) mais sa page n'existe pas encore

const ICONE_MAP = {
  'calendar-off': '📅',
  'map-pin': '📍',
  'file-text': '📄',
  'car': '🚗',
  'cpu': '🤖',
  'package': '📦',
  'receipt': '🧾',
  'calendar-check': '📆',
  'users': '👥',
  'check-square': '✅',
  'graduation-cap': '🎓',
  'shield': '🛡',
  'bar-chart': '📊',
  'layout': '🗂',
  'git-branch': '🔀',
  'code': '💻',
  'palette': '🎨',
  'puzzle': '🧩',
}

export default function ModuleEnPreparation({ moduleId, nom, description, icone }) {
  const emoji = ICONE_MAP[icone] || '🧩'

  return (
    <div style={{
      padding: 40,
      maxWidth: 600,
      margin: '40px auto',
      textAlign: 'center',
    }}>
      {/* Icone */}
      <div style={{
        fontSize: 64,
        marginBottom: 20,
        lineHeight: 1,
      }}>
        {emoji}
      </div>

      {/* Badge actif */}
      <div style={{
        display: 'inline-block',
        background: '#ECFDF5',
        color: '#065F46',
        border: '1px solid #6EE7B7',
        borderRadius: 20,
        padding: '4px 14px',
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 16,
        letterSpacing: '0.05em',
      }}>
        MODULE ACTIF
      </div>

      {/* Nom */}
      <h1 style={{
        fontSize: 28,
        fontWeight: 700,
        color: '#1F2937',
        marginBottom: 12,
      }}>
        {nom || moduleId}
      </h1>

      {/* Description */}
      {description && (
        <p style={{
          fontSize: 15,
          color: '#6B7280',
          marginBottom: 28,
          lineHeight: 1.6,
          maxWidth: 420,
          margin: '0 auto 28px',
        }}>
          {description}
        </p>
      )}

      {/* Message en preparation */}
      <div style={{
        background: '#FEF3C7',
        border: '1px solid #FCD34D',
        borderRadius: 12,
        padding: '20px 28px',
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🚧</div>
        <p style={{
          fontSize: 14,
          color: '#92400E',
          fontWeight: 600,
          margin: 0,
          lineHeight: 1.5,
        }}>
          Ce module est active dans votre abonnement
          <br />
          mais n'est pas encore disponible.
        </p>
        <p style={{
          fontSize: 13,
          color: '#B45309',
          margin: '8px 0 0',
          lineHeight: 1.4,
        }}>
          Il sera deploye prochainement.
          Votre abonnement est bien pris en compte.
        </p>
      </div>
    </div>
  )
}

// Composant pour module non autorise (module non actif ou plan insuffisant)
export function ModuleNonAutorise({ moduleId, nom }) {
  return (
    <div style={{
      padding: 40,
      maxWidth: 500,
      margin: '40px auto',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>

      <h2 style={{
        fontSize: 22,
        fontWeight: 700,
        color: '#1F2937',
        marginBottom: 10,
      }}>
        {nom || 'Module'} non disponible
      </h2>

      <div style={{
        background: '#FEF2F2',
        border: '1px solid #FCA5A5',
        borderRadius: 12,
        padding: '20px 28px',
      }}>
        <p style={{
          fontSize: 14,
          color: '#991B1B',
          fontWeight: 600,
          margin: 0,
          lineHeight: 1.5,
        }}>
          Ce module n'est pas inclus dans votre abonnement.
        </p>
        <p style={{
          fontSize: 13,
          color: '#B91C1C',
          margin: '8px 0 0',
          lineHeight: 1.4,
        }}>
          Contactez Velor pour upgrader votre plan.
        </p>
      </div>
    </div>
  )
}
