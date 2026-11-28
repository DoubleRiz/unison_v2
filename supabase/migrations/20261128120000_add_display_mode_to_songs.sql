-- Mode d'affichage choisi par le créateur de la chanson :
-- 'classic' (accords au-dessus des paroles) ou 'columns' (paroles à gauche, accords à droite).
-- NULL : le mode est déduit du contenu à l'affichage (chansons existantes).
alter table public.songs
  add column if not exists display_mode text
  check (display_mode in ('classic', 'columns'));
