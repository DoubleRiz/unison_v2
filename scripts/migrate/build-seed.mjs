// Transforme supabase/migration-data/*.json en un script SQL d'import
// (supabase/migration-data/seed.sql) à exécuter dans le SQL Editor du NOUVEAU
// projet, après supabase/schema.sql.
//
// Les références vers des lignes absentes de l'export (ex. un groupe non lisible)
// sont mises à NULL ou la ligne est ignorée ; tout est signalé dans la console.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = new URL('../../supabase/migration-data/', import.meta.url);

// Colonnes du nouveau schéma, dans l'ordre d'insertion des tables.
const SCHEMA = {
  users:         { cols: ['id', 'username', 'avatar_url', 'updated_at', 'is_admin'] },
  groups:        { cols: ['id', 'name', 'created_by', 'created_at'] },
  group_members: { cols: ['id', 'group_id', 'user_id', 'status', 'role', 'created_at'] },
  songs:         { cols: ['id', 'user_id', 'title', 'artist', 'bpm', 'original_key', 'content', 'notes', 'youtube_url', 'audio_url', 'is_public', 'shared_with_group_id', 'genres', 'tags', 'forked_from', 'created_at', 'updated_at'] },
  favorites:     { cols: ['id', 'user_id', 'song_id', 'created_at'] },
  comments:      { cols: ['id', 'song_id', 'user_id', 'content', 'created_at'] },
  setlists:      { cols: ['id', 'user_id', 'group_id', 'title', 'mode', 'text_notes', 'layout_document', 'created_at'] },
  setlist_songs: { cols: ['id', 'setlist_id', 'song_id', 'position', 'transpose', 'created_at'] },
};
const JSONB = new Set(['text_notes', 'layout_document']);
const ARRAYS = new Set(['genres', 'tags']);

const load = (t) => {
  const f = new URL(`${t}.json`, DIR);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
};
const data = Object.fromEntries(Object.keys(SCHEMA).map((t) => [t, load(t)]));
const ids = (t) => new Set(data[t].map((r) => r.id));
const warn = (m) => console.warn('  ⚠ ' + m);

// --- Intégrité référentielle -------------------------------------------------
const users = ids('users');
// Un auteur sans profil lisible → profil hérité minimal créé.
for (const [t, col] of [['songs', 'user_id'], ['comments', 'user_id'], ['setlists', 'user_id'], ['groups', 'created_by'], ['group_members', 'user_id'], ['favorites', 'user_id']]) {
  for (const r of data[t]) if (r[col] && !users.has(r[col])) {
    users.add(r[col]);
    data.users.push({ id: r[col], username: `ancien_${r[col].slice(0, 8)}`, is_admin: false });
    warn(`profil ${r[col]} absent de l'export : créé sous le nom ancien_${r[col].slice(0, 8)}`);
  }
}
const groups = ids('groups');
const unshared = {};
for (const r of data.songs) if (r.shared_with_group_id && !groups.has(r.shared_with_group_id)) {
  unshared[r.shared_with_group_id] = (unshared[r.shared_with_group_id] || 0) + 1;
  r.shared_with_group_id = null;
}
for (const [g, n] of Object.entries(unshared)) warn(`groupe ${g} non exporté → partage retiré sur ${n} chanson(s)`);
for (const r of data.setlists) if (r.group_id && !groups.has(r.group_id)) {
  warn(`setlist « ${r.title} » : groupe ${r.group_id} non exporté → setlist personnelle`);
  r.group_id = null;
}
data.group_members = data.group_members.filter((r) => groups.has(r.group_id) || (warn(`membre de groupe inconnu ignoré`), false));
const songs = ids('songs');
for (const r of data.songs) if (r.forked_from && !songs.has(r.forked_from)) r.forked_from = null;
for (const t of ['favorites', 'comments', 'setlist_songs']) {
  const before = data[t].length;
  data[t] = data[t].filter((r) => songs.has(r.song_id));
  if (data[t].length < before) warn(`${t} : ${before - data[t].length} ligne(s) vers des chansons non exportées ignorée(s)`);
}
const setlists = ids('setlists');
data.setlist_songs = data.setlist_songs.filter((r) => setlists.has(r.setlist_id));

// --- Génération SQL ------------------------------------------------------------
const lit = (v, col) => {
  if (v === null || v === undefined) return 'null';
  if (ARRAYS.has(col)) return `array[${v.map((x) => lit(x)).join(',')}]::text[]`;
  if (JSONB.has(col)) return `${lit(JSON.stringify(v))}::jsonb`;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

let sql = `-- Import des données de l'ancienne base Unison (généré par build-seed.mjs)\n-- À exécuter dans le SQL Editor du nouveau projet APRÈS supabase/schema.sql.\nbegin;\n`;
// forked_from pointe vers songs : insérer d'abord sans, puis mettre à jour.
const forks = data.songs.filter((r) => r.forked_from).map((r) => [r.id, r.forked_from]);
for (const [table, { cols }] of Object.entries(SCHEMA)) {
  const rows = data[table];
  if (!rows.length) continue;
  const present = cols.filter((c) => rows.some((r) => c in r)); // laisser les défauts sinon
  const extra = [...new Set(rows.flatMap(Object.keys))].filter((c) => !cols.includes(c));
  if (extra.length) warn(`${table} : colonnes inconnues ignorées → ${extra.join(', ')}`);
  sql += `\n-- ${table} (${rows.length})\ninsert into public.${table} (${present.join(', ')}) values\n`;
  sql += rows.map((r) => '  (' + present.map((c) => lit(table === 'songs' && c === 'forked_from' ? null : r[c], c)).join(', ') + ')').join(',\n');
  sql += present.includes('id') ? '\non conflict (id) do nothing;\n' : '\non conflict do nothing;\n';
}
if (forks.length) {
  sql += '\nalter table public.songs disable trigger songs_touch_updated_at;\n';
  for (const [id, parent] of forks) sql += `update public.songs set forked_from = '${parent}' where id = '${id}';\n`;
  sql += 'alter table public.songs enable trigger songs_touch_updated_at;\n';
}
sql += '\ncommit;\n';

writeFileSync(new URL('seed.sql', DIR), sql);
console.log('\nseed.sql généré :');
for (const t of Object.keys(SCHEMA)) console.log(`  ${t.padEnd(14)} ${data[t].length}`);
