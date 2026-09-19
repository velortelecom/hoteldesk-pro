// src/modules/pointage/components/MesHeures.test.js
// =====================================================================
// C'est l'ecran ou un salarie verifie son decompte. S'il ment, il ment
// a la personne qui a le plus interet a ce qu'il soit juste -- et c'est
// la seule qui ne peut pas le corriger elle-meme.
//
// Deux choses s'y jouent :
//   - il ne montre QUE les journees de celui qui regarde ;
//   - une journee non calculable n'y vaut pas zero heure.
// =====================================================================
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import MesHeures from './MesHeures.jsx'

global.IS_REACT_ACT_ENVIRONMENT = true

const MOI = 'profil-moi'
const AUTRE = 'profil-collegue'

function journee(profileId, jour, { minutes = 480, complete = true, anomalies = [] } = {}) {
  return {
    id: profileId + '@' + jour,
    profileId,
    employe: profileId === MOI ? 'Moi Meme' : 'Un Collegue',
    site: 'Site 1',
    date: jour.slice(8) + '/' + jour.slice(5, 7) + '/' + jour.slice(0, 4),
    jour,
    periode: jour.slice(0, 7),
    entree: '08:00',
    sortie: complete ? '17:00' : '—',
    pause: '1h00',
    duree: complete ? '8h00' : '—',
    minutesTravaillees: complete ? minutes : null,
    complete,
    anomalies,
    anomaliesLisibles: anomalies,
    provenance: 'etablissement',
    provenanceLisible: 'Etablissement',
  }
}

function rendre(props) {
  const conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  const racine = createRoot(conteneur)
  act(() => {
    racine.render(<MesHeures profile={{ id: MOI }} {...props} />)
  })
  return {
    texte: conteneur.textContent,
    conteneur,
    demonter: () => act(() => racine.unmount()),
  }
}

describe('l ecran ne montre que mes journees', () => {
  test('les journees d un collegue n apparaissent pas', () => {
    // Un responsable ou un admin ouvre le meme ecran et recoit, lui,
    // toute l'equipe depuis la base. Sans ce filtre, « Mes heures »
    // afficherait les heures des autres.
    const { texte, demonter } = rendre({
      journees: [
        journee(MOI, '2026-09-10'),
        journee(AUTRE, '2026-09-10'),
        journee(AUTRE, '2026-09-11'),
      ],
    })
    expect(texte).toContain('Moi Meme'.slice(0, 0) + '10/09/2026')
    expect(texte).not.toContain('Un Collegue')
    expect(texte).toContain('Journees comptees')
    demonter()
  })

  test('sans profil, on ne montre rien plutot que tout', () => {
    const { texte, demonter } = rendre({
      profile: null,
      journees: [journee(MOI, '2026-09-10'), journee(AUTRE, '2026-09-10')],
    })
    expect(texte).toContain('Aucune journee enregistree')
    demonter()
  })
})

describe('une journee non calculable ne vaut pas zero', () => {
  const journees = [
    journee(MOI, '2026-09-10'),
    journee(MOI, '2026-09-11'),
    journee(MOI, '2026-09-12', { complete: false, anomalies: ['Aucun depart enregistre'] }),
  ]

  test('le total ne compte que les journees completes', () => {
    const { texte, demonter } = rendre({ journees })
    expect(texte).toContain('16h00')
    demonter()
  })

  test('le nombre de journees non calculees est annonce, pas noye', () => {
    const { texte, demonter } = rendre({ journees })
    expect(texte).toContain('Journees non calculees')
    expect(texte).toContain('elles ne sont PAS dans le total')
    demonter()
  })

  test('la raison est affichee sur la ligne', () => {
    const { texte, demonter } = rendre({ journees })
    expect(texte).toContain('Aucun depart enregistre')
    demonter()
  })

  test('sans journee incomplete, aucun avertissement', () => {
    const { texte, demonter } = rendre({ journees: [journee(MOI, '2026-09-10')] })
    expect(texte).not.toContain('Journees non calculees')
    demonter()
  })
})

describe('choix du mois', () => {
  test('seuls les mois ayant des journees sont proposes', () => {
    // Proposer « juillet » a quelqu'un embauche en septembre n'aide
    // personne et fait croire a des heures perdues.
    const { conteneur, demonter } = rendre({
      journees: [journee(MOI, '2026-09-10'), journee(MOI, '2026-07-02')],
    })
    const options = [...conteneur.querySelectorAll('option')].map((o) => o.value)
    expect(options).toEqual(['2026-09', '2026-07'])
    demonter()
  })

  test('un mois sans rien le dit, au lieu d un tableau vide', () => {
    const { texte, demonter } = rendre({ journees: [] })
    expect(texte).toContain('Aucune journee enregistree')
    demonter()
  })
})

describe('etats de chargement', () => {
  test('une lecture ratee ne se lit pas « aucune journee »', () => {
    // Un ecran vide se lit « je n'ai pas travaille ». C'est un mensonge
    // quand la lecture a simplement echoue.
    const { texte, demonter } = rendre({ journees: [], erreur: 'reseau indisponible' })
    expect(texte).toContain("n'ont pas pu etre lues")
    expect(texte).not.toContain('Aucune journee enregistree')
    demonter()
  })

  test('pendant le chargement, on ne conclut pas', () => {
    const { texte, demonter } = rendre({ journees: [], chargement: true })
    expect(texte).toContain('Lecture de vos pointages')
    expect(texte).not.toContain('Aucune journee enregistree')
    demonter()
  })
})
