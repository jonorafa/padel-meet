-- ═══════════════════════════════════════════════════════════════════════
-- 037 — Compteur anti-abus pour l'edge function notify-support.
--
-- Contexte : notify-support était déployée avec verify_jwt = false et un
-- CORS en '*'. N'importe qui pouvait, sans aucune clé, déclencher un envoi
-- d'e-mail en boucle vers la boîte du projet. Le durcissement se fait en
-- trois temps : verify_jwt (config.toml), CORS restreint + validation
-- (index.ts), et cette table qui borne le débit par utilisateur.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.support_rate_limit (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Index sur (user_id, created_at desc) : la seule lecture faite par la
-- fonction est « combien de lignes pour CET utilisateur depuis 1 h ».
create index if not exists support_rate_limit_user_time_idx
  on public.support_rate_limit (user_id, created_at desc);

alter table public.support_rate_limit enable row level security;

-- AUCUNE policy, volontairement : ni anon ni authenticated ne doivent
-- toucher cette table, y compris en lecture (elle révélerait qui a écrit au
-- support et quand). Seule l'edge function y accède, via SERVICE_ROLE_KEY,
-- qui contourne la RLS par conception.
--
-- ⚠️ C'est précisément pour cela que index.ts utilise un client service_role
-- pour cette table et NON le jeton de l'utilisateur : sous le rôle
-- `authenticated`, une table avec RLS activée et zéro policy renvoie
-- count = 0 sans lever d'erreur (et rejette les INSERT). Le compteur
-- resterait donc à 0 pour toujours et la limite ne se déclencherait jamais,
-- silencieusement.

-- Purge : garder l'historique complet n'a aucun intérêt et accumulerait des
-- données personnelles (qui a contacté le support, quand) au-delà de leur
-- finalité. Seule la dernière heure sert au calcul.
-- À brancher sur pg_cron si le volume le justifie un jour ; en l'état, la
-- table reste minuscule.
comment on table public.support_rate_limit is
  'Compteur glissant 1 h pour notify-support. Purgeable au-delà de 24 h : seule la dernière heure est lue.';
