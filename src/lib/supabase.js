import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://example.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'example-anon-key'

/**
 * Evenement emis quand la base refuse une ecriture parce que la periode
 * d'essai de l'entreprise est terminee.
 *
 * Cote base, c'est le trigger trg_lecture_seule (19 tables metier) qui leve
 * l'exception 'ESSAI_TERMINE'. PostgREST la renvoie en HTTP 400 avec un corps
 * JSON du type :
 *
 *   { "code": "P0001",
 *     "message": "ESSAI_TERMINE",
 *     "details": "Periode d'essai terminee : compte en lecture seule.",
 *     "hint": "Contactez Velor Telecom pour activer votre abonnement." }
 *
 * Sans interception, l'utilisateur voit une erreur brute ou, pire, rien du
 * tout. On l'attrape ici, une seule fois, plutot que dans chaque appel.
 */
export const EVENEMENT_ESSAI_TERMINE = 'velor:essai-termine'

async function fetchAvecGardeEssai(input, init) {
  const reponse = await fetch(input, init)

  // Chemin normal : on ne touche a rien.
  if (reponse.ok) return reponse

  try {
    // clone() est indispensable : lire le corps le consomme, et l'appelant
    // doit encore pouvoir le lire.
    const corps = await reponse.clone().json()
    const message = corps && typeof corps.message === 'string' ? corps.message : ''

    if (message.indexOf('ESSAI_TERMINE') !== -1) {
      window.dispatchEvent(new CustomEvent(EVENEMENT_ESSAI_TERMINE, {
        detail: {
          message: (corps && corps.details) || null,
          aide: (corps && corps.hint) || null,
        },
      }))
    }
  } catch (e) {
    // Corps absent ou non JSON : ce n'est pas notre cas, on laisse passer.
  }

  return reponse
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
  global: { fetch: fetchAvecGardeEssai },
})
