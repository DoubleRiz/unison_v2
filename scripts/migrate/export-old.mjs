// Exporte les données de l'ANCIENNE base Supabase en JSON (supabase/migration-data/).
//
//   node scripts/migrate/export-old.mjs           → données publiques seulement
//   node scripts/migrate/export-old.mjs --login   → se connecte avec un compte Unison
//                                                   (email + mot de passe demandés)
//                                                   pour récupérer aussi ses setlists,
//                                                   groupes, favoris et chansons privées.
//
// --login peut être relancé avec plusieurs comptes : les exports sont fusionnés.
// L'URL et la clé anon de l'ancienne base sont lues dans OLD_SUPABASE_URL /
// OLD_SUPABASE_ANON_KEY (variables d'environnement ou .env).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const OUT = new URL('../../supabase/migration-data/', import.meta.url);
const TABLES = ['users', 'groups', 'group_members', 'songs', 'favorites', 'comments', 'setlists', 'setlist_songs'];

function readEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

const env = readEnv();
const url = process.env.OLD_SUPABASE_URL || env.OLD_SUPABASE_URL;
const key = process.env.OLD_SUPABASE_ANON_KEY || env.OLD_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('URL / clé anon de l\'ancienne base introuvables');
if (url.includes('zfbmvzvqpbplqdmascpo')) throw new Error('OLD_SUPABASE_URL pointe vers la NOUVELLE base');

const supabase = createClient(url, key, { auth: { persistSession: false } });
console.log(`Ancienne base : ${url}`);

if (process.argv.includes('--login')) {
  const email = await ask('Email du compte Unison : ');
  const password = await ask('Mot de passe : ', true);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { console.error('Connexion refusée :', error.message); process.exit(1); }
  console.log(`Connecté (id ${data.user.id})`);
}

mkdirSync(OUT, { recursive: true });
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) { console.warn(`  ${table}: ${error.message}`); break; }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  // Fusion avec un export précédent (par id)
  const file = new URL(`${table}.json`, OUT);
  const merged = new Map(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).map((r) => [r.id ?? JSON.stringify(r), r]) : []);
  for (const r of rows) merged.set(r.id ?? JSON.stringify(r), r);
  writeFileSync(file, JSON.stringify([...merged.values()], null, 2));
  console.log(`  ${table.padEnd(14)} ${String(rows.length).padStart(4)} lues, ${merged.size} au total`);
}
console.log('\nÉtape suivante : node scripts/migrate/build-seed.mjs');
