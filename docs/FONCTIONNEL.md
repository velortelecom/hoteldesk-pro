# Fonctionnel

## Espaces disponibles

### Utilisateur entreprise

- accueil / dashboard
- planning
- tâches
- messagerie
- rappels
- congés
- organisation
- pointage

### Super Admin

- supervision
- structure entreprise
- utilisateurs
- assistance
- santé plateforme

## Rôles métier actifs

- `super_admin`
- `admin`
- `responsable`
- `chef_equipe`
- `employe`

## Parcours couverts par le socle actuel

- connexion et chargement du profil
- chargement des modules actifs d’entreprise
- navigation desktop/mobile
- chargement des données cœur avec filtrage entreprise
- création et mise à jour de tâches
- conversation directe entre membres d’une même entreprise
- rappels manuels et rappels automatiques navigateur
- pointage (création, édition, vue historique et état d’équipe)
- congés (demande, validation responsable/admin, impact planning)
- événements métier (création tâche/rappel, notifications ciblées)
- notifications persistantes (centre de notifications + compteur non lus)
- supervision Super Admin (cockpit supervision, structure, assistance, audit)

## Portée V2 explicitement livrée

- planning opérationnel et événements associés
- équipes et gestion des profils (dont rôle `chef_equipe`)
- conversations entreprise (messagerie)
- workflow congés et absences
- assistance et cockpit Super Admin

## Hors périmètre V2 (masqué)

- modules catalogue non implémentés (`gps`, `documents`, `vehicules`, `stocks`, `facturation`, `reservations`, `clients`, `qualite`, `formations`, `securite`, `rapports`, `planning_avance`, `multi_sites`, `api`, `white_label`, `ia`)
