# Super Admin Performance - Avant / Apres

## Perimetre
Corrections sans ajout fonctionnel sur:
- chargement legacy entreprises
- panneau plateforme
- persistance assistance (polling leger)

## Mesures observees (audit technique)

### 1) Chargement legacy entreprises
Avant:
- 1 requete entreprises
- 1 requete modules
- 1 requete details
- 1 requete health
- 1 requete audit
- N requetes utilisateurs (1 par entreprise)
- Total: 5 + N requetes (N=39 => 44 requetes)

Apres:
- 1 requete entreprises
- 1 requete modules
- 1 requete details
- 1 requete health
- 1 requete audit
- 1 requete utilisateurs globale
- Total: 6 requetes fixes

Gain:
- Suppression du N+1 utilisateurs
- Charge reseau stabilisee sur environ 6 requetes

### 2) Panneau plateforme
Avant:
- Appels GitHub public non limites par timeout
- Rechargement complet a chaque ouverture

Apres:
- Timeout reseau 3.5s sur appels GitHub
- Cache session 5 minutes (commit/statut/migrations/functions)
- Les API externes lentes ne bloquent plus toute la page au-dela du timeout

### 3) Assistance globale
Ajout:
- Lecture serveur de la session active au niveau shell
- Polling toutes les 30s pour coherences expiration/fermeture

Impact:
- Banner persistant inter-pages avec cout reseau borne
- Pas de rechargement massif associe

## Cibles produit
- Navigation pages deja chargees: sous 1s visee
- Premier affichage utile: sous 3s visee
- Plus de navigation normale a 8-15s due au N+1 et blocages externes

## Notes
Les mesures ci-dessus sont basees sur comptage de requetes et timings controles dans le code.
La validation chronometree finale doit etre faite sur Preview Vercel avec DevTools reseau (cold/warm cache).
