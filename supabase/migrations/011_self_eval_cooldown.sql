-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011 — Réévaluation niveau : cooldown mensuel
-- Ajoute last_self_eval_date pour limiter l'auto-évaluation à 1×/mois.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_self_eval_date DATE;
