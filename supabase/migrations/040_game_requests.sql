-- ═══════════════════════════════════════════════════════════════════════════
-- 040 — « Concierge » : demandes de partie partageables par lien.
--
-- PORTÉE VOLONTAIREMENT MINIMALE. Ce n'est PAS le module « games » complet
-- (parties, participants, confirmations, comptage de places). Ce socle-là
-- reste non construit tant que ce Concierge léger n'a pas montré une demande
-- réelle : un créateur écrit ce qu'il cherche, partage un lien hors de l'app
-- (WhatsApp), et on mesure si ça débouche sur une vraie partie.
--
-- Une seule table, aucun état de participation. Trouver les joueurs manquants
-- se fait dans la conversation WhatsApp, pas dans l'app — c'est précisément ce
-- qu'on cherche à valider avant d'investir dans la mécanique complète.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.game_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  city          TEXT,
  club_name     TEXT,
  level_min     NUMERIC(3,1),
  level_max     NUMERIC(3,1),
  spots_needed  INT NOT NULL DEFAULT 1 CHECK (spots_needed BETWEEN 1 AND 3),
  -- Hex et non base64 : un token base64 contient /, + et = qui doivent être
  -- encodés dans une URL et cassent le collage d'un lien dans WhatsApp.
  share_token   TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_requests_creator_idx
  ON public.game_requests (creator_id, scheduled_at DESC);

ALTER TABLE public.game_requests ENABLE ROW LEVEL SECURITY;

-- Le créateur gère les siennes. Personne d'autre ne lit la table en direct :
-- l'aperçu par lien passe par la RPC ci-dessous, qui ne rend que les champs
-- nécessaires et jamais creator_id.
DROP POLICY IF EXISTS game_requests_select_own ON public.game_requests;
CREATE POLICY game_requests_select_own ON public.game_requests
  FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS game_requests_insert_own ON public.game_requests;
CREATE POLICY game_requests_insert_own ON public.game_requests
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS game_requests_delete_own ON public.game_requests;
CREATE POLICY game_requests_delete_own ON public.game_requests
  FOR DELETE USING (auth.uid() = creator_id);

-- ── Aperçu public par token ────────────────────────────────────────────────
-- Appelée depuis /g/:token par quelqu'un qui n'a pas de compte : c'est tout
-- l'intérêt du lien partagé sur WhatsApp. Elle ne renvoie QUE ce qu'il faut
-- pour décider si on est intéressé — jamais creator_id, jamais le token des
-- autres demandes.
--
-- Le prénom du créateur est inclus (« Jonathan cherche 1 joueur ») : sans lui
-- l'aperçu est anonyme au point d'être inutilisable. `split_part` limite au
-- premier mot — pas le nom de famille.
CREATE OR REPLACE FUNCTION public.get_game_request_preview(p_token TEXT)
RETURNS TABLE(
  creator_first_name TEXT,
  scheduled_at       TIMESTAMPTZ,
  city               TEXT,
  club_name          TEXT,
  level_min          NUMERIC,
  level_max          NUMERIC,
  spots_needed       INT,
  is_past            BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT split_part(COALESCE(p.name, ''), ' ', 1),
         g.scheduled_at, g.city, g.club_name,
         g.level_min, g.level_max, g.spots_needed,
         g.scheduled_at < NOW()
  FROM game_requests g
  JOIN profiles p ON p.id = g.creator_id
  WHERE g.share_token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_request_preview(TEXT) TO anon, authenticated;
