# Déploiement

## Local

```bash
npm install
npm test -- --watchAll=false --runInBand
npm run build
```

## Supabase

- projet lié : `vcpnrisxbnvyupsbieie`
- exécution ciblée d’une migration SQL possible avec :

```bash
supabase db query --linked --file "supabase/migrations/<migration>.sql"
```

## Preview Vercel

- le workflow attendu est le push GitHub
- l’URL de preview se récupère via les statuts de déploiement GitHub/Vercel
