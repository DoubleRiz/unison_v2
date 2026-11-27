# Unison — Claude Code Guide

## Présentation

**Unison** est une PWA pour musiciens permettant de :
- Retrouver des chansons et consulter leurs accords/paroles
- Transposer les accords à la volée et afficher les degrés harmoniques
- Créer et gérer des setlists pour les concerts/répétitions
- Organiser des groupes/bands et partager des chansons
- Accéder à des outils musicaux (dictionnaire d'accords, progressions d'accords)

## Stack technique

- **React 19** + **TypeScript** + **Vite 6**
- **Supabase** : authentification (email/password) + base de données PostgreSQL
- **Tailwind CSS** : thème clair/sombre (classes `dark:`)
- **jsPDF** : export PDF des setlists
- Dev server : `npm run dev` → port 3000

### Navigation
Pas de router — navigation par état `currentView` dans `App.tsx` (type union string).
Vues disponibles : `landing` (page marketing si déconnecté, `HomeDashboard` si connecté) `| main | editor | profile | setlists | groups | search | help | chord-dictionary | progressions | email-confirmed | reset-password`

### Structure des fichiers
```
App.tsx                    # Racine : gestion session, navigation, état global
types.ts                   # Types partagés : Song, Setlist, Group, GroupMember, Comment, NotationMode
hooks/useAppData.ts        # Fetch songs, groups, invites en fonction de la session
lib/supabaseClient.ts      # Client Supabase (URL + anon key hardcodés)
utils/musicLogic.ts        # Logique musicale : transpose, degrés, détection sections
constants/chordShapes.ts   # Voicings d'accords pour le dictionnaire
components/
  SongSheet.tsx            # Affichage d'une chanson avec accords
  SongEditor.tsx           # Éditeur de chanson
  AdvancedSearch.tsx       # Recherche avancée (filtres genres, tags)
  SetlistEditor.tsx        # Éditeur de setlists avec export PDF
  GroupManager.tsx         # Gestion des groupes/bands et invitations
  LandingPage.tsx          # Page d'accueil non-connectée (plein écran, sans sidebar)
  HomeDashboard.tsx        # Accueil connecté (dernières chansons, setlists, favoris)
  ui/                      # Brand.tsx (logo, badges), styles.ts (classes partagées), Segmented.tsx, Modal.tsx
  tools/
    ChordDictionary.tsx    # Dictionnaire visuel d'accords
    ChordProgressions.tsx  # Outil progressions d'accords
```

### Design system (refonte graphique)
Maquettes de référence : canvas « Unison, maquettes des pages » (claude.ai artifact).
- **Typo** : Red Hat Display (titres, `font-display`), Red Hat Text (texte), Red Hat Mono (accords, tons, chiffres, `font-mono`)
- **Couleurs** : les palettes Tailwind `slate` et `cyan` sont **remappées** dans `index.html` (`tailwind.config`) :
  - neutres chauds : `slate-100` #F1F2EE (fond), `slate-50`/`white` #FBFBF9 (surface), `slate-200` #D5D8D0 (filets), `ink` #16181D (texte)
  - sombre : `slate-950` #111318, `slate-900` #171A20, `slate-800` #2A2E36
  - accent : `cyan-600` #2440D6 (clair) / `cyan-400` #93A5FF (sombre), teinte `cyan-100` / `cyan-900`
  - signal (défilement, scène) : `red-500` #D3402A / `red-400` #FF6B54 ; ambre `amber-400` #F5B83D
- **Rayons** : `rounded`=3px, `rounded-md`/`lg`=4px, `rounded-xl`=6px. Pas de dégradés, pas de flou décoratif.
- **Composants partagés** : `components/ui/Brand.tsx` (Logo, KeyBadge, DiceIcon, Initials, Eyebrow), `components/ui/styles.ts` (classes input/bouton/alerte), `components/ui/Segmented.tsx` (contrôle segmenté), `components/ui/Modal.tsx` (dialogue)
- Libellés d'interface en français.

### Responsive
- `isMobile` (< 768px) → `BottomNav` + sidebar masquée
- Desktop → `Sidebar` latérale persistante (248px : logo, nouvelle chanson, recherche, navigation, profil, thème)
- Mobile → `Navbar` (barre haute : logo, recherche, hasard, thème) + `BottomNav`

### Format des chansons
Le contenu (`Song.content`) est du texte brut avec les accords entre crochets :
```
[Verse 1]
[Am]           [F]    [C]
Hello darkness my old friend
```
- Sections : `[Intro]`, `[Verse]`, `[Chorus]`, `[Bridge]`, etc.
- Accords : `[Am]`, `[C#m7]`, `[G/B]` (avec basse)
- La transposition et la conversion en degrés sont gérées dans `utils/musicLogic.ts`

### Base de données Supabase
Tables principales : `songs`, `favorites`, `setlists`, `setlist_songs`, `groups`, `group_members`, `users`
- Colonne DB `original_key` → propriété TS `key`

### Auth & accès
- Connecté : possibilité de créer des chansons, setlists, groupes

## Conventions de développement

- Composants en `React.FC` avec props typées via `interface`
- Tout le styling via Tailwind (pas de fichiers CSS séparés)
- Pas de state manager global — état centralisé dans `App.tsx`, passé par props drilling
- Appels Supabase directs dans les composants ou dans `useAppData` (pas de couche service)
