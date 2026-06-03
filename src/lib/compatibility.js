// Score 0–100 : niveau proche + main complémentaire + dispo en commun + matchs communs
export function compatScore(me, p) {
  // me est le profil brut DB (dominant_hand), p est le joueur transformé (hand)
  const myLevel = me.level ?? 3.5;
  const myHand  = me.hand ?? me.dominant_hand;
  const myAvail = me.availability || [];

  let s = 0;
  // Niveau proche (max 45 pts) : écart 0 → 45, écart ≥2 → 0
  s += Math.max(0, 45 - Math.abs(myLevel - (p.level ?? 3.5)) * 22);
  // Mains complémentaires : gaucher + droitier = paire naturelle (max 20)
  s += myHand && p.hand && myHand !== p.hand ? 20 : 8;
  // Disponibilités communes (max 20)
  const overlap = myAvail.filter(a => (p.availability || []).includes(a)).length;
  s += Math.min(20, overlap * 10);
  // Matchs communs (max 15)
  s += Math.min(15, (p.commonMatches || 0) * 7);
  return Math.round(Math.max(40, Math.min(99, s)));
}
