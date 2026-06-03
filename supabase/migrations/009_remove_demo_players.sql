-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — Suppression des joueurs de démonstration en production
-- ─────────────────────────────────────────────────────────────────────────────
-- Tous les profils is_demo = true sont des bots insérés par la migration 006.
-- Leurs FK (swipes, matches, messages, notifications, peer_evaluations, etc.)
-- sont toutes ON DELETE CASCADE → un seul DELETE suffit.
--
-- ATTENTION : cette migration est irréversible.
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM public.profiles WHERE is_demo = true;
