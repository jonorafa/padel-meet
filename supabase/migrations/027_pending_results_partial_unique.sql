-- ============================================================================
-- PADEL MEET — Migration 027 : contrainte d'unicité correcte sur les scores en
-- attente (index partiel, pas total)
-- ============================================================================
-- Trouvaille du chantier 7 (audit corps par corps EU vs Tokyo, lecture seule) :
-- la contrainte d'unicité de pending_match_results diffère en SÉMANTIQUE entre
-- les deux projets, pas seulement en nom.
--
--   001_schema.sql (ce que rejoue EU) :
--     CONSTRAINT unique_pending_per_pair UNIQUE (submitter_id, opponent_id, status)
--     → unicité TOTALE sur (soumetteur, adversaire, statut)
--
--   Tokyo (modifié à la main, jamais capturé dans une migration) :
--     CREATE UNIQUE INDEX idx_one_pending_per_pair
--       ON pending_match_results (submitter_id, opponent_id)
--       WHERE status = 'pending'
--     → unicité PARTIELLE : un seul enregistrement EN ATTENTE par paire à la
--       fois, mais l'historique (confirmed/rejected/expired) n'est PAS limité
--
-- Conséquence concrète de la version totale (celle d'EU, non corrigée) :
-- confirm_match_result fait UPDATE ... SET status = 'confirmed'. Deux mêmes
-- joueurs ne pourraient JAMAIS confirmer un second match ensemble — la
-- deuxième ligne (A, B, 'confirmed') violerait la contrainte. Idem pour un
-- deuxième refus ou une deuxième expiration entre les deux mêmes joueurs.
--
-- Preuve avec des données réelles (lecture seule, chantier 7) : Tokyo contient
-- déjà une paire avec 2 lignes 'rejected' — état qui existe en production et
-- qui serait rejeté par la contrainte actuelle d'EU.
--
-- Vérifié avant cette migration (lecture seule) : aucune ligne existante sur
-- EU n'a deux enregistrements 'pending' pour la même paire — l'index partiel
-- peut être créé sans conflit.
--
-- Idempotent — ré-exécutable.
-- ============================================================================

ALTER TABLE public.pending_match_results
  DROP CONSTRAINT IF EXISTS unique_pending_per_pair;

DROP INDEX IF EXISTS idx_one_pending_per_pair;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_per_pair
  ON public.pending_match_results (submitter_id, opponent_id)
  WHERE status = 'pending';

-- ============================================================================
-- ✅ Migration 027 terminée
-- ============================================================================
