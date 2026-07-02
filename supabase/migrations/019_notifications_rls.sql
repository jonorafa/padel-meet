-- ============================================================================
-- PADEL MEET — Migration 019 : Durcissement RLS des notifications
-- ============================================================================
-- Problème : la policy "Anyone can insert notifications" (WITH CHECK (true))
-- permettait à n'importe quel utilisateur authentifié d'insérer une
-- notification arbitraire pour n'importe qui (spam, usurpation de from_id,
-- fausses notifications système).
--
-- Côté client, les SEULES insertions légitimes sont celles de useSwipes.js :
--   • type 'like'  — j'ai swipé à droite sur quelqu'un
--   • type 'match' — match mutuel détecté
-- Toutes les autres notifications (score, éval, proposition de match…) sont
-- créées par des fonctions SECURITY DEFINER qui ne passent PAS par cette
-- policy — on peut donc verrouiller sans rien casser.
--
-- Nouvelle règle : un utilisateur ne peut insérer que
--   • en se déclarant lui-même comme expéditeur (from_id = auth.uid())
--   • pour un destinataire ≠ lui-même
--   • avec un type client autorisé ('like' | 'match')
--   • et uniquement s'il n'existe AUCUN blocage entre les deux (dans les 2 sens)
--
-- Idempotent — ré-exécutable.
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_sender      ON public.notifications;

CREATE POLICY notifications_insert_sender ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() = from_id
    AND user_id <> auth.uid()
    AND type IN ('like', 'match')
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = user_id     AND b.blocked_id = auth.uid())
         OR (b.blocker_id = auth.uid()  AND b.blocked_id = user_id)
    )
  );
