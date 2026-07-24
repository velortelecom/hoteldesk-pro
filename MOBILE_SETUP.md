# Passage en application mobile (Capacitor)

Ce document explique comment transformer l'application web Velor One (React / Create React App) en application mobile Android et iOS grace a Capacitor, sans reecrire le code existant.

## Pourquoi Capacitor

- Reutilise 100% du code React/JS existant (aucune reecriture necessaire).
- Le routage utilise deja HashRouter (voir src/App.jsx), ce qui est directement compatible avec Capacitor.
- Genere de vrais projets natifs Android (Android Studio) et iOS (Xcode), publiables sur Google Play et l'App Store.

## Prerequis a installer en local (pas dans le navigateur)

- Node.js et npm (deja utilises pour le projet).
- Android Studio (pour compiler/tester sur Android).
- Xcode, uniquement sur Mac (pour compiler/tester sur iOS).

## Etapes a executer en local

### 1. Recuperer cette branche et installer les dependances

`git checkout claude/mobile-capacitor-setup`

### 2. Construire le web build de production

`npm run build`

### 3. Ajouter les plateformes natives (a faire une seule fois)

`npx cap add android`
`npx cap add ios`

Cela va generer les dossiers android/ et ios/ contenant de vrais projets natifs.

### 4. Synchroniser le build web vers les projets natifs (a refaire a chaque changement de code)

`npm run cap:sync`

### 5. Ouvrir et lancer sur un appareil/emulateur

`npm run cap:open:android`
`npm run cap:open:ios`

Cela ouvre Android Studio / Xcode, ou vous pouvez lancer l'app sur un emulateur ou un appareil connecte.

## Configuration

Le fichier capacitor.config.ts a la racine du projet contient :

- appId : com.velor.hoteldeskpro
- appName : Velor One
- webDir : build (dossier genere par npm run build)

Vous pouvez ajuster l'appId avant la premiere publication sur les stores (il ne doit plus changer ensuite).

## Prochaines etapes possibles

- Icones et splash screens natifs (via @capacitor/assets).
- Notifications push (via @capacitor/push-notifications) connectees a Supabase.
- Gestion du mode hors-ligne.
- Publication sur Google Play Console et App Store Connect (necessite des comptes developpeur payants).
