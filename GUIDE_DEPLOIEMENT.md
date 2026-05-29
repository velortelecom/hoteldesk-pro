# 🏨 HôtelDesk Pro — Guide de déploiement complet

## Ce que vous avez

- **Planning** semaine avec glisser par heure
- **Tâches** avec CRUD complet, filtres, assignation
- **Messagerie** temps réel entre collègues (Supabase Realtime)
- **Rappels** avec notifications push (PWA)
- **Authentification** complète (login / inscription)
- **PWA** installable sur iPhone et Android

---

## ÉTAPE 1 — Supabase : créer la base de données

1. Allez sur https://supabase.com → votre projet
2. Menu gauche : **SQL Editor** → cliquez **New query**
3. Copiez-collez tout le contenu du fichier `supabase_schema.sql`
4. Cliquez **Run** (ou Ctrl+Entrée)
5. Vérifiez dans **Table Editor** que les tables `profiles`, `taches`, `messages`, `rappels` existent

### Récupérer vos clés Supabase

1. Menu gauche : **Settings** → **API**
2. Copiez :
   - **Project URL** → c'est votre `SUPABASE_URL`
   - **anon public** (sous Project API keys) → c'est votre `SUPABASE_ANON_KEY`

---

## ÉTAPE 2 — Configurer l'application

1. Renommez `.env.example` en `.env`
2. Remplacez les valeurs :

```
REACT_APP_SUPABASE_URL=https://abcdefgh.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ÉTAPE 3 — Tester en local

```bash
# Dans le dossier hotel-app
npm install
npm start
```

Ouvrez http://localhost:3000 — créez votre premier compte (admin).

---

## ÉTAPE 4 — Déployer sur Vercel (gratuit)

### Option A — Via GitHub (recommandé)

1. Créez un compte sur https://github.com
2. Créez un nouveau dépôt (repository) privé appelé `hoteldesk`
3. Dans le dossier `hotel-app` :
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VOTRE_NOM/hoteldesk.git
git push -u origin main
```
4. Allez sur https://vercel.com → **New Project** → importez votre repo GitHub
5. Dans **Environment Variables**, ajoutez :
   - `REACT_APP_SUPABASE_URL` = votre URL
   - `REACT_APP_SUPABASE_ANON_KEY` = votre clé
6. Cliquez **Deploy** → votre app est en ligne en ~2 minutes !

### Option B — Via Vercel CLI

```bash
npm install -g vercel
npm run build
vercel --prod
```

Vercel vous donnera une URL du type : `https://hoteldesk-xxx.vercel.app`

---

## ÉTAPE 5 — Installer sur les téléphones

### Sur iPhone (Safari)
1. Ouvrez l'URL de votre app dans Safari
2. Appuyez sur l'icône **Partager** (carré avec flèche)
3. Choisissez **Ajouter à l'écran d'accueil**
4. L'app s'installe comme une vraie app !

### Sur Android (Chrome)
1. Ouvrez l'URL dans Chrome
2. Une bannière apparaît : **Installer l'application**
3. Ou : menu ⋮ → **Ajouter à l'écran d'accueil**

---

## ÉTAPE 6 — Nom de domaine (optionnel)

Pour avoir `tasks.monhotel.fr` au lieu de `hoteldesk.vercel.app` :

1. Achetez un domaine sur OVH (~10€/an) ou Namecheap
2. Dans Vercel : **Settings** → **Domains** → ajoutez votre domaine
3. Suivez les instructions DNS de Vercel (5 minutes)

---

## Structure des fichiers

```
hotel-app/
├── public/
│   ├── index.html        ← Page principale
│   ├── manifest.json     ← Config PWA (icône, nom...)
│   └── sw.js             ← Service Worker (offline + notifs)
├── src/
│   ├── lib/
│   │   └── supabase.js   ← Connexion Supabase
│   ├── hooks/
│   │   └── useAuth.js    ← Authentification
│   ├── pages/
│   │   ├── Login.jsx     ← Page connexion/inscription
│   │   ├── Planning.jsx  ← Vue calendrier semaine
│   │   ├── Taches.jsx    ← Liste tâches + CRUD
│   │   ├── Messagerie.jsx← Chat temps réel
│   │   └── Rappels.jsx   ← Rappels + notifications
│   ├── App.jsx           ← Navigation principale
│   └── index.js          ← Point d'entrée
├── .env                  ← Vos clés Supabase (⚠️ ne pas commiter)
├── .env.example          ← Template
├── package.json
└── supabase_schema.sql   ← À coller dans Supabase SQL Editor
```

---

## FAQ

**Les notifications ne marchent pas sur iPhone ?**
iOS 16.4+ est requis pour les notifications PWA. Assurez-vous que l'app est installée sur l'écran d'accueil (pas juste ouverte dans Safari).

**Erreur "Invalid API key" ?**
Vérifiez que le `.env` contient bien les bonnes valeurs et que vous avez relancé `npm start`.

**Comment ajouter un nouveau collaborateur ?**
Il suffit qu'il s'inscrive via l'app. Vous pouvez changer son rôle depuis Supabase → Table Editor → profiles.

**Puis-je personnaliser le nom de l'hôtel ?**
Oui, cherchez "HôtelDesk" dans `App.jsx` et `public/index.html` et remplacez par le vrai nom.
