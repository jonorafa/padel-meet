// Score 0–100 : proximité de niveau + main complémentaire + correspondance « partenaire idéal ».
// me  = profil brut DB (dominant_hand, partner_prefs, level)
// p   = joueur transformé (hand, side, style, motivation, level)
export function compatScore(me, p) {
  const myLevel = me.level ?? 3.5;
  const myHand  = me.hand ?? me.dominant_hand;
  const pLevel  = p.level ?? 3.5;

  let s = 0;

  // 1) Proximité de niveau (max 45) : écart 0 → 45, écart ≥ ~2 → 0
  s += Math.max(0, 45 - Math.abs(myLevel - pLevel) * 22);

  // 2) Mains complémentaires : gaucher + droitier = paire naturelle (8 ou 18)
  s += myHand && p.hand && myHand !== p.hand ? 18 : 8;

  // 3) Correspondance avec « le partenaire idéal » (partner_prefs) — scoring souple.
  //    Chaque critère que l'utilisateur a explicitement défini (≠ 'any') et que
  //    le joueur p satisfait fait monter le score. Aucun joueur n'est jamais exclu.
  const pref = me.partner_prefs || {};
  if (pref.hand && pref.hand !== 'any' && p.hand === pref.hand) s += 8;
  if (pref.side && pref.side !== 'any' && p.side === pref.side) s += 8;
  if (pref.style && pref.style !== 'any' && p.style === pref.style) s += 7;
  if (pref.motivation && pref.motivation !== 'any' && p.motivation === pref.motivation) s += 7;
  if (pref.levelMin != null && pref.levelMax != null && p.level != null
      && p.level >= pref.levelMin && p.level <= pref.levelMax) s += 12;
  // Note : pref.region (sous-régions d'Israël) n'est pas encore utilisé ici —
  // la taxonomie diffère du filtre de recherche (pays). À aligner avant câblage.

  return Math.round(Math.max(40, Math.min(99, s)));
}
