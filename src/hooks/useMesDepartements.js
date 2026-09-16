// src/hooks/useMesDepartements.js
// =====================================================================
// Les departements de la personne connectee, exprimes en CODES.
//
// L'appartenance est stockee dans employe_departements avec des uuid,
// alors que taches.departement est du texte et correspond a
// departements.code. Ce hook fait la traduction une fois pour toutes, pour
// que la regle de visibilite n'ait a comparer que des codes.
//
// profiles.departement -- l'ancienne etiquette texte limitee a
// reception/menage/maintenance/restauration/direction -- est ajoutee en
// dernier recours : des comptes anciens n'ont que celle-la, et sans ca ils
// ne verraient plus rien du jour au lendemain.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useMesDepartements() {
  const { profile } = useAuth()
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let annule = false

    async function charger() {
      if (!profile?.id) {
        setCodes([])
        setLoading(false)
        return
      }
      setLoading(true)

      const { data, error } = await supabase
        .from('employe_departements')
        .select('departement:departements(code)')
        .eq('profile_id', profile.id)

      if (annule) return

      const trouves = (!error && data)
        ? data.map(l => l.departement && l.departement.code).filter(Boolean)
        : []

      if (profile.departement && trouves.indexOf(profile.departement) === -1) {
        trouves.push(profile.departement)
      }

      setCodes(trouves)
      setLoading(false)
    }

    charger()
    return () => { annule = true }
  }, [profile?.id, profile?.departement])

  return { codesDepartements: codes, loading }
}
