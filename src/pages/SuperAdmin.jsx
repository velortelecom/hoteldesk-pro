// src/pages/SuperAdmin.jsx
// Back-office Super Admin Velor One
// Accessible uniquement aux utilisateurs avec is_super_admin = true
// Ce role est RESERVE a Velor et ne peut pas etre cree par un admin

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PLANS } from '../lib/modules'

export default function SuperAdmin() {
  const { profile } = useAuth()
  const [entreprises, setEntreprises] = useState([])
  const [modules, setModules] = useState([])
  const [stats, setStats] = useState({ total: 0, actives: 0, par_plan: {} })
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState('entreprises')

  useEffect(() => {
    if (!profile?.is_super_admin) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const [{ data: ents }, { data: mods }] = await Promise.all([
      supabase.from('entreprises').select('*').order('created_at', { ascending: false }),
      supabase.from('modules_catalogue').select('*').order('ordre'),
    ])
    if (ents) {
      setEntreprises(ents)
      const par_plan = {}
      ents.forEach(e => { par_plan[e.plan] = (par_plan[e.plan] || 0) + 1 })
      setStats({
        total: ents.length,
        actives: ents.filter(e => e.actif).length,
        par_plan,
      })
    }
    if (mods) setModules(mods)
    setLoading(false)
  }

  // Garde : seul super_admin peut voir cette page
  if (!profile?.is_super_admin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>
        <h2>Acces refuse</h2>
        <p>Cette page est reservee aux administrateurs Velor.</p>
      </div>
    )
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>

  const PLAN_COLORS = { starter: '#6B7280', business: '#3B82F6', premium: '#8B5CF6', enterprise: '#F59E0B' }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#1F2937', color: 'white', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
          VELOR SUPER ADMIN
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1F2937' }}>Back-office Velor One</h1>
      </div>

      {/* Stats globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard titre='Entreprises totales' valeur={stats.total} couleur='#3B82F6' />
        <StatCard titre='Entreprises actives' valeur={stats.actives} couleur='#10B981' />
        <StatCard titre='Plan Business+' valeur={(stats.par_plan.business || 0) + (stats.par_plan.premium || 0) + (stats.par_plan.enterprise || 0)} couleur='#8B5CF6' />
        <StatCard titre='Modules catalogue' valeur={modules.length} couleur='#F59E0B' />
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E5E7EB' }}>
        {['entreprises', 'modules', 'plans'].map(o => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: '6px 6px 0 0',
              background: onglet === o ? '#3B82F6' : 'transparent',
              color: onglet === o ? 'white' : '#6B7280',
              fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {o}
          </button>
        ))}
      </div>

      {/* Onglet Entreprises */}
      {onglet === 'entreprises' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
            Toutes les entreprises ({entreprises.length})
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                  {['Nom', 'Secteur', 'Plan', 'Statut', 'Utilisateurs max', 'Cree le'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entreprises.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{e.nom}</td>
                    <td style={{ padding: '10px 14px', color: '#6B7280' }}>{e.secteur}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: PLAN_COLORS[e.plan] + '22', color: PLAN_COLORS[e.plan], borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                        {e.plan}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: e.actif ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                        {e.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6B7280' }}>{e.max_utilisateurs || 'Illimite'}</td>
                    <td style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: 11 }}>
                      {e.created_at ? new Date(e.created_at).toLocaleDateString('fr-FR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onglet Modules */}
      {onglet === 'modules' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
            Catalogue des modules ({modules.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {modules.map(m => (
              <div key={m.id} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{m.nom}</span>
                  <span style={{ background: PLAN_COLORS[m.plan_minimum] + '22', color: PLAN_COLORS[m.plan_minimum], borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                    {m.plan_minimum}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{m.description}</p>
                <div style={{ marginTop: 8, fontSize: 11, color: '#9CA3AF' }}>
                  Categorie: {m.categorie} | ID: {m.id}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onglet Plans */}
      {onglet === 'plans' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Plans d'abonnement</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {Object.values(PLANS).map(p => (
              <div key={p.id} style={{ border: '2px solid ' + p.couleur, borderRadius: 10, padding: 20, textAlign: 'center' }}>
                <div style={{ color: p.couleur, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{p.nom}</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
                  {p.prix ? p.prix + 'e/mois' : 'Sur devis'}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{p.description}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {p.max_utilisateurs ? p.max_utilisateurs + ' utilisateurs max' : 'Illimite'}
                </div>
                <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, color: p.couleur }}>
                  {stats.par_plan[p.id] || 0} client(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ titre, valeur, couleur }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', borderLeft: '4px solid ' + couleur }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{titre}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: couleur }}>{valeur}</div>
    </div>
  )
      }
