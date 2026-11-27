# 🎸 Unison

PWA pour musiciens : retrouver ses chansons, transposer les accords à la volée, créer des setlists pour les concerts, et organiser ses groupes autour d'un répertoire partagé.

## 🎯 Le problème

Un musicien qui joue en groupe jongle en général entre plusieurs PDF, applis d'accords et fichiers épars : pas de transposition rapide, pas de vue d'ensemble du répertoire du groupe, et aucune façon simple de préparer une setlist pour un concert.

## ▶️ Lancer le projet

```bash
npm install
npm run dev
```

Le serveur de dev tourne sur le port 3000. Nécessite un projet [Supabase](https://supabase.com) configuré.

## 🏗️ Architecture

Pas de router — la navigation passe par un état `currentView` centralisé dans `App.tsx` (union de strings) :

```
landing | main | editor | profile | setlists | groups | search
| help | chord-dictionary | progressions | email-confirmed | reset-password
```

### Structure des fichiers

```
App.tsx                    # Racine : gestion de session, navigation, état global
types.ts                   # Types partagés : Song, Setlist, Group, GroupMember, Comment, NotationMode
hooks/useAppData.ts        # Fetch songs, groups, invites en fonction de la session
lib/supabaseClient.ts      # Client Supabase
utils/musicLogic.ts        # Logique musicale : transpose, degrés, détection de sections
constants/chordShapes.ts   # Voicings d'accords pour le dictionnaire
components/
  SongSheet.tsx            # Affichage d'une chanson avec accords
  SongEditor.tsx           # Éditeur de chanson
  AdvancedSearch.tsx       # Recherche avancée (filtres genres, tags)
  SetlistEditor.tsx        # Éditeur de setlists avec export PDF
  GroupManager.tsx         # Gestion des groupes/bands et invitations
  LandingPage.tsx          # Page d'accueil non-connectée
  tools/
    ChordDictionary.tsx    # Dictionnaire visuel d'accords
    ChordProgressions.tsx  # Outil progressions d'accords
```

### Responsive

- Mobile (< 768px) → `BottomNav` + sidebar masquée
- Desktop → `Sidebar` latérale persistante

### Format des chansons

Le contenu (`Song.content`) est du texte brut avec les accords entre crochets :

```
[Verse 1]
[Am]           [F]    [C]
Hello darkness my old friend
```

- Sections : `[Intro]`, `[Verse]`, `[Chorus]`, `[Bridge]`, etc.
- Accords : `[Am]`, `[C#m7]`, `[G/B]` (avec basse)
- La transposition et la conversion en degrés s'appuient sur `utils/musicLogic.ts`

## ✨ Fonctionnalités

- **Recherche et affichage des chansons** — paroles et accords, recherche avancée par genre et tags
- **Transposition à la volée** — changement de tonalité instantané, affichage en degrés harmoniques
- **Setlists exportables** — création de setlists pour concerts/répétitions, export PDF
- **Groupes et partage** — gestion de bands, invitations et partage de répertoire
- **Outils musicaux** — dictionnaire d'accords visuel, explorateur de progressions d'accords
- **Thème clair/sombre**

## 🛠️ Stack technique

React 19 · TypeScript · Vite 6 · Supabase (Auth + PostgreSQL) · Tailwind CSS · jsPDF

## 💻 Développement local

**Prérequis :** Node.js 20+

1. Installer les dépendances : `npm install`
2. Copier `.env.example` en `.env` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
3. Lancer le serveur de dev : `npm run dev` (port 3000)
4. Tests : `npm test`

## 🚀 Déploiement (Hostinger)

L'application est un site statique généré par Vite :

- **Commande de build :** `npm run build`
- **Dossier publié :** `dist/`
- **Variables d'environnement (au moment du build) :** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Le fichier `public/.htaccess` est copié dans `dist/` au build. Il force le HTTPS, renvoie
toute route inconnue vers `index.html` et règle le cache : les fichiers hachés de
`/assets/` sont mis en cache un an, tandis que `index.html`, `sw.js` et `manifest.json`
ne sont jamais mis en cache pour que les mises à jour de la PWA arrivent immédiatement.

Pensez à ajouter le domaine Hostinger dans Supabase → Authentication → URL Configuration
(Site URL et Redirect URLs), sinon les liens de confirmation d'e-mail et de
réinitialisation de mot de passe pointeront vers l'ancien domaine.
