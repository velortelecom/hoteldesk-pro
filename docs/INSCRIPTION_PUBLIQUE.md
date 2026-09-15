# Inscription publique autonome — Velor One (Plan 1)

Branche : `pointage-migration-draft`

## 1. Ce qui est livré

| Couche | Élément | Rôle |
|---|---|---|
| SQL | `supabase/migrations/20260915_inscription_publique_plan1.sql` | `entreprises.origine` + `nombre_employes`, `inscriptions_tentatives`, `demandes_pack`, trigger anti-escalade, RPC `public_signup_create_entreprise_atomic` |
| Edge | `supabase/functions/public-signup/index.ts` | Seul point d'entrée public : validation, anti-abus, création, audit, rollback |
| Edge | `supabase/functions/_shared/plan1.ts` | Constantes Plan 1 serveur + seuils anti-abus |
| Edge | `supabase/functions/_shared/secteurs_templates.ts` | Templates secteur (généré, ne pas éditer) |
| Front | `src/pages/Inscription.jsx` | Page publique `#inscription` |
| Front | `src/pages/Offres.jsx` | Packs supérieurs « Disponible sur demande » |
| Front | `src/lib/plan1.js` | Définition Plan 1 **d'affichage** |
| Outil | `scripts/gen-secteurs-deno.mjs` | Régénère le template Deno depuis `src/lib/secteurs.js` |

## 2. Source de vérité du Plan 1

Trois endroits, un seul qui fait foi à l'écriture :

1. **`public_signup_create_entreprise_atomic`** (SQL) — `c_modules := ARRAY['organisation','conges']`, `c_plan := 'starter'`.
   C'est **la seule autorité**. Aucun paramètre de la RPC ne permet de changer le plan ou les modules.
2. `supabase/functions/_shared/plan1.ts` — miroir serveur, sert à la validation et au contrôle post-création.
3. `src/lib/plan1.js` — affichage uniquement.

Les tests `src/lib/plan1.test.js` et `supabase/functions/_shared/plan1.test.ts` échouent si les trois divergent
ou si un module squelette entre dans le Plan 1.

## 3. Ce que le navigateur ne peut pas faire

Le payload accepté est strictement : `nom_entreprise`, `secteur`, `admin_prenom`, `admin_nom`,
`email`, `password`, `password_confirm`, `telephone`, `nombre_employes`.

Les champs `role`, `is_super_admin`, `entreprise_id`, `plan`, `modules`, `modules_selectionnes`,
`prix_mensuel`, `max_utilisateurs`, `origine` sont **ignorés** et leur présence est tracée
(console + métadonnées d'audit `champs_ignores`).

Défenses en profondeur :

- RLS : `entreprises_insert` exige `is_super_admin()`, `entreprise_modules_*` aussi (module write lock).
  Le rôle `anon` n'a **aucune** policy d'écriture. Tout passe par `service_role` dans l'Edge Function.
- Trigger `profiles_anti_escalade` : refuse toute écriture de `is_super_admin = true` hors `service_role`
  et hors Super Admin déjà en place.
- La RPC est `REVOKE`d de `anon` et `authenticated`, `GRANT`ée à `service_role` seul.
- Contrôle post-création dans l'Edge Function : si `entreprise_modules` contient un module hors Plan 1,
  l'inscription est annulée (rollback).

## 4. Anti-abus

Journal `inscriptions_tentatives` (lecture Super Admin uniquement). Seuils dans `_shared/plan1.ts` :

- 3 inscriptions abouties max par IP / 24 h
- 10 tentatives max par IP / 1 h
- 5 tentatives max par email / 1 h

Dépassement → HTTP 429 avec message métier.

## 5. Rollback

La RPC est une transaction unique : entreprise, site, modules, départements, postes et profil admin
sont écrits ou rien ne l'est. Seul le compte Auth vit hors transaction.

En cas d'échec, l'Edge Function supprime, dans l'ordre :

1. l'entreprise créée le cas échéant (cascade : sites, `entreprise_modules`, départements, postes) ;
2. le compte Auth (cascade : `profiles`).

Si une suppression échoue, la tentative est tracée avec le préfixe `ROLLBACK_INCOMPLET` dans
`inscriptions_tentatives.motif_echec`. **Requête de contrôle :**

```sql
select created_at, email, motif_echec
from public.inscriptions_tentatives
where succes = false and motif_echec like 'ROLLBACK_INCOMPLET%'
order by created_at desc;
```

L'interface ne reçoit jamais d'erreur SQL brute : uniquement `message` en français.

## 6. Déploiement

```bash
# 1. Migration
supabase link --project-ref vcpnrisxbnvyupsbieie
supabase db push          # applique 20260915_inscription_publique_plan1.sql

# 2. Edge Function — PUBLIQUE, donc sans vérification de JWT
supabase functions deploy public-signup --no-verify-jwt

# 3. (optionnel) restreindre l'origine CORS
supabase secrets set ALLOWED_ORIGIN=https://app.velorone.app

# 4. Front : déploiement Vercel habituel de la branche
```

> `--no-verify-jwt` est **obligatoire** : un prospect n'a pas de session. La fonction reste protégée par
> sa validation stricte, l'anti-abus et le fait qu'elle ne peut rien créer d'autre qu'un Plan 1.

## 7. Recette QA

### 7.1 Parcours nominal

1. Ouvrir `https://<preview>/#inscription`
2. Remplir le formulaire, valider « Créer mon espace Velor One »
3. Vérifier la connexion automatique et l'arrivée sur le Dashboard
4. Contrôles SQL :

```sql
-- entreprise
select id, nom, slug, plan, secteur, origine, nombre_employes, created_at
from public.entreprises where origine = 'inscription_autonome' order by created_at desc limit 1;

-- modules : doit renvoyer exactement conges + organisation
select module_id, actif from public.entreprise_modules
where entreprise_id = '<ID>' and actif order by module_id;

-- admin
select p.id, p.prenom, p.nom, p.role, p.is_super_admin, p.entreprise_id, u.email
from public.profiles p join auth.users u on u.id = p.id where p.entreprise_id = '<ID>';

-- template secteur
select count(*) from public.departements where entreprise_id = '<ID>';
select count(*) from public.postes where entreprise_id = '<ID>';

-- audit
select action, description, metadonnees from public.audit_events
where entreprise_id = '<ID>' and action = 'inscription_autonome';
```

5. Navigation attendue du nouvel admin : Accueil, Planning, Tâches, Messages, Rappels, Équipe,
   Organisation & RH, Congés & Absences, Offres. **Aucun autre module.**

### 7.2 Isolation RLS

Connecté en tant que nouvel admin :

```sql
select count(*) from public.entreprises;   -- doit valoir 1
select count(*) from public.profiles;      -- uniquement les membres de son entreprise
```

### 7.3 Rollback

Provoquer l'échec sans toucher au code de production : renommer temporairement la RPC.

```sql
alter function public.public_signup_create_entreprise_atomic(
  text, text, text, text, integer, jsonb, jsonb, uuid, text, text
) rename to public_signup_create_entreprise_atomic_ko;
```

Tenter une inscription → message métier, HTTP 500. Puis vérifier qu'il ne reste rien :

```sql
select * from auth.users where email = '<email de test>';                 -- 0 ligne
select * from public.profiles p join auth.users u on u.id=p.id
  where u.email = '<email de test>';                                      -- 0 ligne
select * from public.entreprises where email_contact = '<email de test>'; -- 0 ligne
```

Restaurer :

```sql
alter function public.public_signup_create_entreprise_atomic_ko(
  text, text, text, text, integer, jsonb, jsonb, uuid, text, text
) rename to public_signup_create_entreprise_atomic;
```

### 7.4 Anti-escalade

```sql
-- connecté en tant qu'admin d'entreprise : doit lever forbidden_super_admin_escalation
update public.profiles set is_super_admin = true where id = auth.uid();
```

### 7.5 Suppression de l'entreprise QA

```sql
select public.supprimer_entreprise_complete('<ID>');
```

## 8. Points laissés volontairement de côté

- **Stripe** : aucun paiement. Le champ `prix_mensuel` est informatif.
- **Packs 2 et 3** : présentés en « Disponible sur demande », jamais activables. Une demande crée une
  ligne `demandes_pack`, traitée manuellement dans l'onglet **Demandes** du Super Admin.
- **Les 16 modules squelettes** : aucune modification de leur logique.
- **`create-entreprise/index.ts`** : contient toujours un appel à `supabase.auth.admin.getUserByEmail`,
  méthode inexistante dans supabase-js v2 (le correctif `09db2ce` ne portait que sur `create-user`).
  Ce chemin Super Admin peut donc échouer à la création d'un premier admin. **Hors périmètre de ce
  chantier**, mais à corriger : `public-signup` contourne le problème en interrogeant la vue
  `profiles_with_email`.
