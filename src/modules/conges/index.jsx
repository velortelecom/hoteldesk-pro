// src/modules/conges/index.jsx
// MODULE: Conges & Absences - v0.1.0 - Squelette V4
// Note: import useAuth retire car non utilise dans cette version squelette

export default function CongesModule({ permissions, entreprise, profile }) {
  return (
    <div style={{ padding: 40, maxWidth: 700, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏖️</div>
      <div style={{ display: 'inline-block', background: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
        Module actif - En cours de developpement
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1F2937', marginBottom: 10 }}>Conges & Absences</h1>
      <p style={{ fontSize: 15, color: '#6B7280', marginBottom: 28, lineHeight: 1.6 }}>Gestion des demandes de conges, absences et jours feries.</p>
      <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: '20px 28px', marginBottom: 24 }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🚧</div>
        <p style={{ fontSize: 14, color: '#92400E', fontWeight: 600, margin: 0 }}>Ce module est active dans votre abonnement mais pas encore disponible.</p>
        <p style={{ fontSize: 12, color: '#B45309', margin: '8px 0 0' }}>Il sera deploye prochainement.</p>
      </div>
    </div>
  )
}
