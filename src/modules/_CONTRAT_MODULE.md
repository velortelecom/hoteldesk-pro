# CONTRAT D'UN MODULE VELOR ONE

## Structure obligatoire

```
src/modules/<nom_module>/
├── index.jsx          # Composant principal (page du module)
├── config.js          # Configuration du module (constantes, parametres)
├── permissions.js     # Surcharge des permissions par defaut
├── routes.js          # Sous-routes du module (si besoin)
├── services.js        # Requetes Supabase et logique metier
├── hooks.js           # Hooks React specifiques au module
├── components/        # Composants UI du module
│   └── .gitkeep
└── pages/             # Sous-pages du module (si navigation interne)
    └── .gitkeep
```

## Contrat index.jsx

```jsx
// Le composant principal doit accepter ces props :
export default function MonModule({ permissions, entreprise, profile }) {
  // permissions : { voir, creer, modifier, supprimer, exporter, valider }
  // entreprise : { id, nom, plan, ... }
  // profile : { id, prenom, nom, role, ... }
}
```

## Contrat config.js

```js
export const MODULE_CONFIG = {
  id: 'mon_module',
  version: '0.1.0',
  // parametres specifiques au module
}
```

## Contrat permissions.js

```js
// Surcharge des permissions par role
// Si non defini, utilise ROLE_PERMISSIONS de registry.js
export const PERMISSIONS_PAR_ROLE = {
  employe:     { voir: true, creer: false, ... },
  responsable: { voir: true, creer: true,  ... },
  admin:       { voir: true, creer: true,  ... },
}
```

## Contrat services.js

```js
import { supabase } from '../../lib/supabase'

// Toutes les requetes Supabase du module sont ici
// Jamais dans les composants directement
export async function fetchData(entrepriseId) { ... }
export async function createItem(payload) { ... }
export async function updateItem(id, payload) { ... }
export async function deleteItem(id) { ... }
```

## Contrat hooks.js

```js
import { useState, useEffect } from 'react'
import * as services from './services'

// Hook principal du module
export function useMonModule(entrepriseId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  // ...
  return { data, loading }
}
```

## Regles absolues

1. Un module NE DOIT PAS importer depuis un autre module
2. Un module PEUT importer depuis src/lib/ et src/hooks/useAuth
3. Un module NE DOIT PAS modifier le socle
4. Un module DOIT respecter l'isolation par entreprise_id
5. Toutes les requetes Supabase DOIVENT filtrer par entreprise_id
6. Un module DOIT fonctionner meme si desactive (code non execute)

## Cycle de vie d'un module

```
Activation en BDD (entreprise_modules.actif = true)
    ↓
registry.js detecte le module
    ↓
loader.js construit ModuleCharge
    ↓
App.jsx ajoute le menu dans la nav
    ↓
React.lazy charge le composant au premier acces
    ↓
permissions.js filtre les actions disponibles
    ↓
services.js execute les requetes isolees par entreprise
```

## Versions

- 0.1.0 : Architecture squelette (V4)
- 1.0.0 : Module completement developpe
- x.y.z : semver standard
