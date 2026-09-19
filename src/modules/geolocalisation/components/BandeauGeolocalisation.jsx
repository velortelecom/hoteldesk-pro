// src/modules/geolocalisation/components/BandeauGeolocalisation.jsx
// =====================================================================
// « VOTRE POSITION EST RELEVEE ».
//
// POURQUOI CE BANDEAU EXISTE
//   Parce qu'un dispositif de suivi dont la personne ignore l'existence
//   n'est pas seulement deloyal : il est inopposable. Rien de ce qui a
//   ete collecte avant qu'elle soit informee ne peut servir.
//
//   Et parce que le raisonnement « s'il ne veut pas etre localise, il
//   n'a qu'a ne pas se connecter le dimanche » n'a de sens que s'il
//   SAIT. Sans ce bandeau, cette phrase suppose une information qui
//   n'a jamais ete donnee.
//
// POURQUOI IL EST DISCRET ET PERMANENT
//   Discret : quelqu'un qui travaille sous ce regime toute l'annee n'a
//   pas besoin d'une alarme rouge a chaque ecran. Un bandeau agressif
//   se fait ignorer en trois jours, puis reprocher.
//
//   Permanent : une information donnee une fois a la premiere connexion
//   est une information oubliee. Elle doit etre la quand la question se
//   pose -- c'est-a-dire un dimanche soir, au moment d'ouvrir
//   l'application.
//
// CE QU'IL DIT EXACTEMENT
//   Ce qu'on releve, quand, et pendant combien de temps on le garde.
//   Pas de formule vague : « conformement a la reglementation » n'a
//   jamais renseigne personne.
// =====================================================================
import React, { useState } from 'react'

const CONSERVATION_JOURS = 365

export default function BandeauGeolocalisation({ inscrit = false, charge = true }) {
  const [deplie, setDeplie] = useState(false)

  // Tant qu'on ne sait pas, on n'affiche rien. Faire clignoter un
  // bandeau de surveillance au chargement de chaque page serait pire
  // que de ne rien dire.
  if (!charge || !inscrit) return null

  return (
    <div
      style={{
        background: '#FFFBEB',
        borderBottom: '1px solid #FDE68A',
        color: '#92400E',
        fontSize: 12.5,
        padding: deplie ? '10px 16px 14px' : '8px 16px',
        lineHeight: 1.6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span aria-hidden="true">📍</span>
        <strong>Votre position est relevée par votre employeur.</strong>
        <button
          type="button"
          onClick={() => setDeplie((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#92400E',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: 12.5,
            padding: 0,
          }}
        >
          {deplie ? 'Masquer le détail' : 'En savoir plus'}
        </button>
      </div>

      {deplie && (
        <div style={{ marginTop: 8, display: 'grid', gap: 6, maxWidth: 760 }}>
          <div>
            <strong>Quand :</strong> à votre connexion, et lorsque vous terminez une
            tâche, prenez une photo ou enregistrez une visite. Uniquement pendant
            votre temps de travail &mdash; hors de vos horaires, aucune position n&apos;est
            relevée.
          </div>
          <div>
            <strong>Quoi :</strong> votre position au moment de l&apos;action, sa précision,
            et le type d&apos;appareil. Aucun suivi continu n&apos;est possible : votre
            position n&apos;est pas relevée lorsque l&apos;application est fermée ou en
            arrière-plan.
          </div>
          <div>
            <strong>Combien de temps :</strong> {CONSERVATION_JOURS} jours, puis les
            relevés sont supprimés.
          </div>
          <div>
            <strong>Qui y accède :</strong> la direction de votre entreprise et votre
            responsable de département.
          </div>
          <div style={{ color: '#78350F' }}>
            Vous pouvez demander à consulter les données vous concernant auprès de
            votre employeur.
          </div>
        </div>
      )}
    </div>
  )
}
