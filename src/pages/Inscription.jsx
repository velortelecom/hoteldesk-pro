// src/pages/Inscription.jsx
// =====================================================================
// PAGE PUBLIQUE D'INSCRIPTION - Velor One
//
// Le formulaire n'ecrit RIEN directement en base. Il appelle l'Edge
// Function public-signup, qui est le seul point d'entree autorise et qui
// impose le Plan 1 cote serveur. Le plan, le role et la liste des modules
// ne sont donc jamais envoyes depuis ici : les afficher suffit.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { SECTEURS_OPTIONS } from '../lib/secteurs'
import { BrandMark, APP_NAME } from '../branding/Brand'
import {
  PLAN_1_LABEL, PLAN_1_PRIX_MENSUEL, PLAN_1_MAX_UTILISATEURS,
  PLAN_1_SOCLE, PLAN_1_MODULES_DETAIL, PACKS_SUPERIEURS, STATUT_SUR_DEMANDE,
} from '../lib/plan1'
import { TARIF_FONDATEUR, PRIX_UTILISATEUR_SUP, PLAFOND_FORFAIT } from '../lib/offres'

const MDP_MIN = 8

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f5f3 0%, #e8e7e0 100%)',
    padding: '32px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  carte: { background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 4px 32px rgba(0,0,0,0.10)' },
  input: {
    width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0',
    borderRadius: 10, fontSize: 15, outline: 'none', background: '#fafaf8', boxSizing: 'border-box',
  },
  inputErreur: {
    width: '100%', padding: '11px 14px', border: '1.5px solid #FCA5A5',
    borderRadius: 10, fontSize: 15, outline: 'none', background: '#FEF2F2', boxSizing: 'border-box',
  },
  label: { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6, display: 'block' },
  aide: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  erreur: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  btn: {
    width: '100%', padding: 13, background: '#185FA5', color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  btnOff: {
    width: '100%', padding: 13, background: '#93C5FD', color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'not-allowed',
  },
  ligne: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
}

function Champ({ label, aide, erreur, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.label}>{label}</label>
      {children}
      {erreur ? <div style={styles.erreur}>{erreur}</div> : (aide ? <div style={styles.aide}>{aide}</div> : null)}
    </div>
  )
}

/**
 * Combien de places fondatrices restent.
 *
 * null = on ne sait pas encore, ou la fonction n'existe pas (migration non
 * appliquee). Dans ce cas on affiche le tarif public et pas de choix de
 * formule : mieux vaut annoncer plus cher que promettre une remise que le
 * serveur ne donnera pas.
 */
function usePlacesFondateur() {
  const [places, setPlaces] = useState(null)

  useEffect(() => {
    let annule = false
    supabase.rpc('places_fondateur_restantes').then(({ data, error }) => {
      if (annule || error || data == null) return
      setPlaces(Number(data))
    })
    return () => { annule = true }
  }, [])

  return places
}

function BlocInclus({ places, formule }) {
  // Le prix affiche doit etre CELUI QUI SERA FACTURE. Tant qu'il reste des
  // places fondatrices, le trigger appliquera 29 EUR : annoncer 39 EUR
  // serait un ecran qui ment, exactement ce qu'on corrige ailleurs.
  const gratuit = formule === 'gratuit'
  const fondateur = !gratuit && places != null && places > 0
  const prix = gratuit ? 0 : (fondateur ? TARIF_FONDATEUR : PLAN_1_PRIX_MENSUEL)

  if (gratuit) {
    return (
      <div style={{ ...styles.carte, background: '#F8FAFC' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', letterSpacing: '0.06em', marginBottom: 4 }}>
          VOTRE ABONNEMENT
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Gratuit</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 18 }}>
          <strong style={{ color: '#111827', fontSize: 15 }}>0 &euro; / mois</strong>
          {' '}&middot; jusqu&apos;a 3 utilisateurs, sans limite de duree
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Inclus d&apos;office</div>
        {PLAN_1_SOCLE.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 16, lineHeight: '20px' }}>{m.icone}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.label}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{m.detail}</div>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '16px 0 8px' }}>Module active</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
          <span style={{ fontSize: 16, lineHeight: '20px' }}>🏢</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Organisation &amp; RH</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Employes, departements, postes, organigramme</div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 16, lineHeight: 1.6 }}>
          Congés et Pointage ne sont pas inclus. Vous pourrez passer a {PLAN_1_LABEL} a
          tout moment depuis votre espace, sans perdre vos donnees.
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.carte, background: '#F8FAFC' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em', marginBottom: 4 }}>
        VOTRE ABONNEMENT
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{PLAN_1_LABEL}</div>
      <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
        {fondateur && (
          <span style={{ textDecoration: 'line-through', marginRight: 6 }}>{PLAN_1_PRIX_MENSUEL} &euro;</span>
        )}
        <strong style={{ color: '#111827', fontSize: 15 }}>{prix} &euro; / mois</strong>
        {' '}&middot; jusqu&apos;a {PLAN_1_MAX_UTILISATEURS} utilisateurs,
        puis {PRIX_UTILISATEUR_SUP} &euro; par utilisateur
      </div>

      {fondateur && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', borderRadius: 10, padding: '10px 12px', fontSize: 12, lineHeight: 1.6, margin: '12px 0 6px' }}>
          <strong>Tarif fondateur &mdash; il reste {places} place{places > 1 ? 's' : ''}.</strong><br />
          Vous gardez ce prix <strong>a vie</strong> sur le perimetre souscrit : le socle,
          Organisation &amp; RH, Conges et Pointage. Les modules publies plus tard pourront
          faire l&apos;objet d&apos;une option.
        </div>
      )}

      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 18, marginTop: fondateur ? 0 : 10 }}>
        Au-dela de {PLAFOND_FORFAIT} salaries, nous etablissons un devis avec vous.
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Inclus d&apos;office</div>
      {PLAN_1_SOCLE.map(m => (
        <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
          <span style={{ fontSize: 16, lineHeight: '20px' }}>{m.icone}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.label}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{m.detail}</div>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '16px 0 8px' }}>Modules actives</div>
      {PLAN_1_MODULES_DETAIL.map(m => (
        <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
          <span style={{ fontSize: 16, lineHeight: '20px' }}>{m.icone}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.label}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{m.detail}</div>
          </div>
        </div>
      ))}

      <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 18, paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Packs superieurs</div>
        {PACKS_SUPERIEURS.map(p => (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
            border: '1px solid #E5E7EB', borderRadius: 10, padding: '9px 12px', marginBottom: 8, background: '#fff',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.nom}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.resume}</div>
            </div>
            <span style={{
              flexShrink: 0, background: '#F3F4F6', color: '#6B7280', borderRadius: 20,
              padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>
              {STATUT_SUR_DEMANDE}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
          Ces packs ne sont pas activables en ligne. Une fois inscrit, vous pourrez en faire la demande
          depuis votre espace : Velor One vous recontacte et active le pack manuellement.
        </div>
      </div>
    </div>
  )
}

export default function Inscription({ onRetourConnexion }) {
  const { signIn } = useAuth()
  const [form, setForm] = useState({
    nom_entreprise: '', secteur: '', admin_prenom: '', admin_nom: '',
    email: '', password: '', password_confirm: '', telephone: '', nombre_employes: '',
  })
  const [erreurs, setErreurs] = useState({})
  const [erreurGlobale, setErreurGlobale] = useState('')
  // Le choix de formule n'est propose QUE s'il ne reste plus de place
  // fondatrice : tant qu'il y en a, l'offre a 29 EUR est meilleure que la
  // gratuite pour tout le monde, et lui opposer un choix serait absurde.
  const places = usePlacesFondateur()
  const [formule, setFormule] = useState('starter')
  const choixPossible = places === 0
  const [etape, setEtape] = useState('formulaire') // formulaire | envoi | succes
  const [resultat, setResultat] = useState(null)

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErreurs(e => (e[k] ? { ...e, [k]: undefined } : e))
  }

  function validerLocalement() {
    const e = {}
    if (form.nom_entreprise.trim().length < 2) e.nom_entreprise = "Indiquez le nom de votre entreprise"
    if (!form.secteur) e.secteur = 'Choisissez votre secteur'
    if (form.admin_prenom.trim().length < 2) e.admin_prenom = 'Prenom requis'
    if (form.admin_nom.trim().length < 2) e.admin_nom = 'Nom requis'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Adresse email invalide'
    if (form.password.length < MDP_MIN) e.password = `${MDP_MIN} caracteres minimum`
    if (form.password !== form.password_confirm) e.password_confirm = 'Les mots de passe ne correspondent pas'
    if (form.nombre_employes && !/^\d{1,6}$/.test(form.nombre_employes)) e.nombre_employes = 'Nombre invalide'
    setErreurs(e)
    return Object.keys(e).length === 0
  }

  async function soumettre(ev) {
    ev.preventDefault()
    setErreurGlobale('')
    if (!validerLocalement()) return
    setEtape('envoi')

    // Payload volontairement limite : ni prix, ni role, ni modules.
    // Seule la formule voyage, et le serveur la revalide.
    const { data, error } = await supabase.functions.invoke('public-signup', {
      body: {
        nom_entreprise: form.nom_entreprise.trim(),
        secteur: form.secteur,
        admin_prenom: form.admin_prenom.trim(),
        admin_nom: form.admin_nom.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        password_confirm: form.password_confirm,
        telephone: form.telephone.trim() || null,
        nombre_employes: form.nombre_employes ? Number(form.nombre_employes) : null,
        // Le serveur ne fait confiance a ce champ que pour l'aiguillage :
        // il en deduit lui-meme le prix, les modules et le plafond.
        formule: choixPossible ? formule : 'starter',
      },
    })

    if (error || !data?.success) {
      // supabase-js range le corps de reponse d'une erreur HTTP dans context
      let details = data
      if (!details && error?.context?.json) {
        try { details = await error.context.json() } catch { /* corps illisible */ }
      }
      const parChamp = {}
      if (Array.isArray(details?.erreurs)) {
        details.erreurs.forEach(x => { if (x?.champ) parChamp[x.champ] = x.message })
      }
      setErreurs(parChamp)
      setErreurGlobale(details?.message || "La creation de votre espace n'a pas pu aboutir. Reessayez dans un instant.")
      setEtape('formulaire')
      return
    }

    setResultat(data)
    setEtape('succes')

    // Connexion automatique puis bascule vers l'espace client.
    const { error: errLogin } = await signIn(form.email.trim().toLowerCase(), form.password)
    if (errLogin) {
      setErreurGlobale('Compte cree, mais la connexion automatique a echoue. Connectez-vous avec vos identifiants.')
      return
    }
    window.location.hash = 'dashboard'
  }

  if (etape === 'succes') {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: 460, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <BrandMark size={60} radius={16} />
          </div>
          <div style={{ ...styles.carte, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Bienvenue sur {APP_NAME}
            </div>
            <div style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6 }}>
              L&apos;espace de <strong>{resultat?.entreprise?.nom}</strong> est pret.
              {resultat?.departements_crees > 0 && (
                <> Nous avons prepare {resultat.departements_crees} departements et {resultat.postes_crees} postes types pour votre secteur.</>
              )}
            </div>
            {erreurGlobale ? (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400E', marginTop: 18 }}>
                {erreurGlobale}
                <button type="button" onClick={onRetourConnexion} style={{ ...styles.btn, marginTop: 12 }}>
                  Aller a la connexion
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 18 }}>Connexion a votre espace...</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const enCours = etape === 'envoi'

  return (
    <div style={styles.page}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <BrandMark size={60} radius={16} />
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginTop: 8 }}>Creer mon espace {APP_NAME}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Quelques informations et votre entreprise est operationnelle.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }} className="inscription-grille">
          <form onSubmit={soumettre} style={styles.carte} noValidate>
            {/* Le choix n'apparait que s'il ne reste plus de place fondatrice.
                Tant qu'il y en a, l'offre a 29 EUR domine la gratuite sur
                tous les criteres : proposer un choix serait une fausse
                question. */}
            {choixPossible && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em', marginBottom: 14 }}>
                  VOTRE FORMULE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 26 }}>
                  {[
                    { id: 'starter', titre: PLAN_1_LABEL, prix: PLAN_1_PRIX_MENSUEL + ' € / mois',
                      detail: 'Jusqu’a ' + PLAN_1_MAX_UTILISATEURS + ' utilisateurs, puis '
                        + PRIX_UTILISATEUR_SUP + ' €. Organisation, Conges et Pointage.' },
                    { id: 'gratuit', titre: 'Gratuit', prix: '0 € / mois',
                      detail: 'Jusqu’a 3 utilisateurs. Organisation & RH uniquement, sans limite de duree.' },
                  ].map(opt => {
                    const actif = formule === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormule(opt.id)}
                        style={{
                          textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '14px 16px',
                          background: actif ? '#EFF6FF' : '#fff',
                          border: '2px solid ' + (actif ? '#185FA5' : '#E5E7EB'),
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{opt.titre}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: actif ? '#185FA5' : '#6B7280', margin: '2px 0 6px' }}>
                          {opt.prix}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.5 }}>{opt.detail}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em', marginBottom: 14 }}>
              VOTRE ENTREPRISE
            </div>

            <Champ label="Nom de l'entreprise *" erreur={erreurs.nom_entreprise}>
              <input style={erreurs.nom_entreprise ? styles.inputErreur : styles.input} value={form.nom_entreprise}
                onChange={e => set('nom_entreprise', e.target.value)} placeholder="Hotel Bellevue" autoComplete="organization" />
            </Champ>

            <Champ label="Secteur d'activite *" erreur={erreurs.secteur}
              aide="Determine les departements et postes prepares dans votre espace.">
              <select style={erreurs.secteur ? styles.inputErreur : styles.input} value={form.secteur}
                onChange={e => set('secteur', e.target.value)}>
                <option value="">Choisir un secteur...</option>
                {SECTEURS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Champ>

            <div style={styles.ligne}>
              <Champ label="Telephone" erreur={erreurs.telephone}>
                <input style={erreurs.telephone ? styles.inputErreur : styles.input} value={form.telephone}
                  onChange={e => set('telephone', e.target.value)} placeholder="Facultatif" autoComplete="tel" />
              </Champ>
              <Champ label="Nombre d'employes" erreur={erreurs.nombre_employes}>
                <input style={erreurs.nombre_employes ? styles.inputErreur : styles.input} value={form.nombre_employes}
                  onChange={e => set('nombre_employes', e.target.value.replace(/\D/g, ''))}
                  placeholder="Facultatif" inputMode="numeric" />
              </Champ>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em', margin: '22px 0 14px', paddingTop: 18, borderTop: '1px solid #F3F4F6' }}>
              VOTRE COMPTE ADMINISTRATEUR
            </div>

            <div style={styles.ligne}>
              <Champ label="Prenom *" erreur={erreurs.admin_prenom}>
                <input style={erreurs.admin_prenom ? styles.inputErreur : styles.input} value={form.admin_prenom}
                  onChange={e => set('admin_prenom', e.target.value)} autoComplete="given-name" />
              </Champ>
              <Champ label="Nom *" erreur={erreurs.admin_nom}>
                <input style={erreurs.admin_nom ? styles.inputErreur : styles.input} value={form.admin_nom}
                  onChange={e => set('admin_nom', e.target.value)} autoComplete="family-name" />
              </Champ>
            </div>

            <Champ label="Adresse email *" erreur={erreurs.email} aide="Elle servira d'identifiant de connexion.">
              <input type="email" style={erreurs.email ? styles.inputErreur : styles.input} value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="vous@entreprise.com" autoComplete="email" />
            </Champ>

            <div style={styles.ligne}>
              <Champ label="Mot de passe *" erreur={erreurs.password} aide={`${MDP_MIN} caracteres minimum`}>
                <input type="password" style={erreurs.password ? styles.inputErreur : styles.input} value={form.password}
                  onChange={e => set('password', e.target.value)} autoComplete="new-password" />
              </Champ>
              <Champ label="Confirmation *" erreur={erreurs.password_confirm}>
                <input type="password" style={erreurs.password_confirm ? styles.inputErreur : styles.input} value={form.password_confirm}
                  onChange={e => set('password_confirm', e.target.value)} autoComplete="new-password" />
              </Champ>
            </div>

            {erreurGlobale && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
                {erreurGlobale}
              </div>
            )}

            <button type="submit" disabled={enCours} style={enCours ? styles.btnOff : styles.btn}>
              {enCours ? 'Creation de votre espace...' : 'Creer mon espace Velor One'}
            </button>

            <button type="button" onClick={onRetourConnexion} style={{
              width: '100%', padding: 11, background: 'none', color: '#888',
              border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 14, marginTop: 12, cursor: 'pointer',
            }}>
              J&apos;ai deja un compte
            </button>
          </form>

          <BlocInclus places={places} formule={choixPossible ? formule : 'starter'} />
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: '#aaa' }}>
          {APP_NAME} &middot; edite par Velor Telecom
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .inscription-grille { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
