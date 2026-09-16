import { etatFinAbonnement, texteDecompte, SEUIL_ALERTE_JOURS } from './abonnement'

const LE_15 = new Date('2026-09-15T10:00:00Z')
const dans = (jours) => new Date(LE_15.getTime() + jours * 86400000).toISOString()

describe('etatFinAbonnement', () => {
  test('rien a signaler quand le renouvellement est actif, meme a la veille', () => {
    expect(etatFinAbonnement({ abonnement_recurrent: true, date_fin_abonnement: dans(1) }, LE_15)).toBeNull()
  })

  test('rien a signaler sans date de fin', () => {
    expect(etatFinAbonnement({ abonnement_recurrent: false, date_fin_abonnement: null }, LE_15)).toBeNull()
  })

  test('rien a signaler au-dela du seuil', () => {
    expect(etatFinAbonnement({ abonnement_recurrent: false, date_fin_abonnement: dans(6) }, LE_15)).toBeNull()
  })

  test('alerte pile au seuil', () => {
    const e = etatFinAbonnement({ abonnement_recurrent: false, date_fin_abonnement: dans(SEUIL_ALERTE_JOURS) }, LE_15)
    expect(e.niveau).toBe('alerte')
    expect(e.jours).toBe(5)
  })

  test('alerte a un jour', () => {
    const e = etatFinAbonnement({ abonnement_recurrent: false, date_fin_abonnement: dans(1) }, LE_15)
    expect(e.niveau).toBe('alerte')
    expect(e.jours).toBe(1)
  })

  test('une echeance dans quelques heures compte encore comme un jour', () => {
    const ceSoir = new Date(LE_15.getTime() + 8 * 3600000).toISOString()
    const e = etatFinAbonnement({ abonnement_recurrent: false, date_fin_abonnement: ceSoir }, LE_15)
    expect(e.niveau).toBe('alerte')
    expect(e.jours).toBe(1)
  })

  test('apres l echeance, on continue de le dire', () => {
    const e = etatFinAbonnement({ abonnement_recurrent: false, date_fin_abonnement: dans(-3) }, LE_15)
    expect(e.niveau).toBe('expire')
  })

  test('entreprise absente ou date illisible : rien, pas une exception', () => {
    expect(etatFinAbonnement(null, LE_15)).toBeNull()
    expect(etatFinAbonnement({ abonnement_recurrent: false, date_fin_abonnement: 'n importe quoi' }, LE_15)).toBeNull()
  })
})

describe('texteDecompte', () => {
  test('rend un decompte lisible', () => {
    expect(texteDecompte({ niveau: 'alerte', jours: 4 })).toBe('J-4')
    expect(texteDecompte({ niveau: 'alerte', jours: 1 })).toBe('Dernier jour')
    expect(texteDecompte({ niveau: 'expire', jours: -2 })).toBe('Echu')
    expect(texteDecompte(null)).toBe('')
  })
})
