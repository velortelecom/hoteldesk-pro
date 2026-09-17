import { messageSuppressionMembre } from './erreurSuppressionMembre'

describe('messageSuppressionMembre', () => {
  test('traduit les motifs leves par la fonction en base', () => {
    expect(messageSuppressionMembre({ message: 'protected_super_admin' })).toMatch(/protege/i)
    expect(messageSuppressionMembre({ message: 'target_profile_missing' })).toMatch(/n'existe plus/i)
    expect(messageSuppressionMembre({ message: 'forbidden_cross_enterprise' })).toMatch(/autre entreprise/i)
    expect(messageSuppressionMembre({ message: 'authentication_required' })).toMatch(/session/i)
  })

  test('forbidden_cross_enterprise ne doit pas etre lu comme forbidden', () => {
    // Les deux motifs se ressemblent ; confondre les deux donnerait un
    // message juste par hasard aujourd'hui et faux demain.
    const message = messageSuppressionMembre({ message: 'forbidden_cross_enterprise' })
    expect(message).not.toMatch(/pas le droit/i)
  })

  test('nomme la table qui bloque', () => {
    const erreur = {
      message: 'update or delete on table "profiles" violates foreign key constraint '
        + '"ticket_messages_sender_profile_id_fkey" on table "ticket_messages"',
    }
    const message = messageSuppressionMembre(erreur)
    expect(message).toContain('ticket_messages')
    expect(message).toContain('ticket_messages_sender_profile_id_fkey')
  })

  test('une panne reseau dit que rien n a ete supprime', () => {
    // Le rassurer sur ce point evite qu'il recommence en croyant avoir
    // a moitie supprime quelqu'un.
    expect(messageSuppressionMembre({ message: 'Failed to fetch' })).toMatch(/rien n'a ete supprime/i)
  })

  test('un motif inconnu est rendu tel quel, jamais avale', () => {
    expect(messageSuppressionMembre({ message: 'quelque chose d inattendu' }))
      .toBe('quelque chose d inattendu')
  })

  test('erreur absente : un message de repli', () => {
    expect(messageSuppressionMembre(null)).toBe('Suppression impossible.')
    expect(messageSuppressionMembre(null, 'autre chose')).toBe('autre chose')
  })
})
