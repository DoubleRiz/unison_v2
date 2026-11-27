# Migration vers le nouveau projet Supabase

Ancien projet : `cphfmtnifonekoioktns` (plus d'accès au dashboard, mais l'API répond encore).
Nouveau projet : `zfbmvzvqpbplqdmascpo`.

Les comptes (auth.users) ne peuvent pas être migrés. Les **profils** (pseudo, admin)
sont conservés comme « profils hérités », pour que les chansons et commentaires
gardent leur auteur. Chacun se réinscrit, puis on relie son nouveau compte à son
profil hérité.

## 1. Exporter l'ancienne base

```bash
node scripts/migrate/export-old.mjs            # public : chansons publiques, profils, commentaires
node scripts/migrate/export-old.mjs --login    # + setlists, groupes, favoris, chansons privées du compte
```

`--login` demande l'email et le mot de passe **du compte Unison** (pas celui de Supabase/GitHub).
On peut le relancer pour plusieurs comptes : les exports sont fusionnés dans `supabase/migration-data/` (ignoré par git).

```bash
node scripts/migrate/build-seed.mjs            # → supabase/migration-data/seed.sql
```

## 2. Créer la base dans le nouveau projet

Dashboard → SQL Editor → New query :
1. coller et exécuter `supabase/schema.sql` ;
2. coller et exécuter `supabase/migration-data/seed.sql`.

## 3. Configurer l'auth du nouveau projet

Authentication → URL Configuration : Site URL = URL de prod, et ajouter
`http://localhost:3000` aux Redirect URLs (confirmation d'email, mot de passe oublié).

## 4. Brancher l'app

Dans `.env` (et dans les variables d'environnement de l'hébergement) :

```
VITE_SUPABASE_URL=https://zfbmvzvqpbplqdmascpo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Project Settings → API Keys → publishable>
```

## 5. Relier les comptes

Après réinscription (Authentication → Users pour le nouvel id) :

```sql
select public.relink_legacy_user('<ancien id>', '<nouvel id>');
```

| Ancien profil  | Ancien id                              |
|----------------|----------------------------------------|
| gogow (admin)  | `5e76c5ee-5edb-4bc4-a79e-c1b782eced02` |
| Raphael music (admin) | `110b42ee-9f09-4323-a3cf-f1c38ec63718` |

Les autres ids sont dans `supabase/migration-data/users.json`.
