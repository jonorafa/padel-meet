import test from 'node:test'
import assert from 'node:assert/strict'
import { QUIZ_QUESTIONS, computeLevel, answerValue, scaleToLevel, OPTION_VALUES } from '../data/courtData.js'

// ─────────────────────────────────────────────────────────────────────────────
// `answers` ne contient QUE du brut : index d'option (0-3) pour les questions
// à choix, cran 1-10 pour les curseurs. La conversion vers le barème vit
// uniquement dans answerValue(), et la RPC serveur submit_level_quiz
// (migration 038) en est le miroir.
//
// Ces tests verrouillent les invariants dont dépend ce miroir. S'ils cassent,
// c'est que le client et le serveur ont divergé — le symptôme côté utilisateur
// serait un niveau affiché différent du niveau enregistré, sans erreur.
// ─────────────────────────────────────────────────────────────────────────────

test('les 13 questions à choix utilisent exactement le barème [1, 2, 3.5, 7]', () => {
  // La RPC serveur code ce tableau en dur et indexe dedans. Si une question
  // s'en écarte, le serveur calculerait un autre niveau que le client.
  const aChoix = QUIZ_QUESTIONS.filter(
    q => q.options && q.options.every(o => o.value !== undefined)
  )
  assert.equal(aChoix.length, 13, '13 questions à choix attendues (4-16)')
  for (const q of aChoix) {
    assert.deepEqual(
      q.options.map(o => o.value), OPTION_VALUES,
      `Q${q.id} diverge du barème serveur`
    )
  }
})

test('les poids correspondent à ceux de la RPC : 1 (Q1-14), 2 (ancres), 0.3 (bonus)', () => {
  const attendus = {}
  for (let i = 1; i <= 14; i++) attendus[i] = 1
  attendus[15] = 2; attendus[16] = 2
  attendus[17] = 0.3; attendus[18] = 0.3; attendus[19] = 0.3
  for (const q of QUIZ_QUESTIONS) {
    assert.equal(q.weight ?? 1, attendus[q.id], `poids de Q${q.id}`)
  }
})

test('answerValue : curseur → scaleToLevel, choix → value, bonus correct → 7', () => {
  const curseur = QUIZ_QUESTIONS.find(q => q.inputType === 'scale')
  assert.equal(answerValue(curseur, 1), scaleToLevel(1))
  assert.equal(answerValue(curseur, 10), scaleToLevel(10))

  const choix = QUIZ_QUESTIONS.find(q => q.id === 4)
  assert.equal(answerValue(choix, 0), 1)
  assert.equal(answerValue(choix, 3), 7)

  const bonus = QUIZ_QUESTIONS.find(q => q.id === 17)
  const iCorrect = bonus.options.findIndex(o => o.correct)
  assert.equal(answerValue(bonus, iCorrect), 7)
})

test('un bonus raté est strictement neutre, jamais pénalisant', () => {
  const bonus = QUIZ_QUESTIONS.find(q => q.id === 17)
  const iFaux = bonus.options.findIndex(o => !o.correct)
  // null → computeLevel l'ignore, ni au numérateur ni au dénominateur.
  assert.equal(answerValue(bonus, iFaux), null)

  const base = {}
  QUIZ_QUESTIONS.filter(q => q.id <= 16).forEach(q => {
    base[q.id] = q.inputType === 'scale' ? 5 : 1
  })
  const sansBonus = computeLevel(base)
  const avecBonusRate = computeLevel({ ...base, 17: iFaux })
  assert.equal(avecBonusRate, sansBonus, 'un bonus raté ne doit rien changer')
})

test('answerValue rend null sur une réponse absente ou un index hors bornes', () => {
  const choix = QUIZ_QUESTIONS.find(q => q.id === 4)
  assert.equal(answerValue(choix, null), null)
  assert.equal(answerValue(choix, undefined), null)
  assert.equal(answerValue(choix, 99), null)
})

test('computeLevel reste dans [0.5, 7.0] aux deux extrêmes du parcours', () => {
  const min = {}, max = {}
  QUIZ_QUESTIONS.forEach(q => {
    if (q.inputType === 'scale') { min[q.id] = 1; max[q.id] = 10; return }
    if (q.options.some(o => o.correct !== undefined)) {
      max[q.id] = q.options.findIndex(o => o.correct)   // bonus réussi
      return                                            // omis côté min
    }
    min[q.id] = 0; max[q.id] = 3
  })

  // Le plancher RÉEL du quiz est 0.9, pas 0.5 : seuls les curseurs (Q1-3)
  // atteignent 0.5, alors que les 13 questions à choix ont une valeur
  // minimale de 1 et pèsent plus lourd au total (11×1 + 2×2 contre 3×1).
  // Le clamp à 0.5 de computeLevel n'est donc jamais atteint par un vrai
  // parcours — il ne protège que d'un barème modifié plus tard.
  assert.equal(computeLevel(min), 0.9)
  assert.ok(computeLevel(min) >= 0.5 && computeLevel(min) <= 7)

  // Le plafond, lui, est bien atteignable : tout à 7 → moyenne 7.
  assert.equal(computeLevel(max), 7)
})

test('computeLevel équivaut au calcul de référence sur des réponses aléatoires', () => {
  // Référence indépendante : dérive la valeur puis applique la moyenne
  // pondérée, sans passer par computeLevel. Attrape une régression dans
  // l'agrégation elle-même, pas seulement dans la conversion.
  const reference = (brut) => {
    let sum = 0, wsum = 0
    for (const q of QUIZ_QUESTIONS) {
      const v = answerValue(q, brut[q.id])
      if (v == null) continue
      const w = q.weight ?? 1
      sum += v * w; wsum += w
    }
    if (wsum === 0) return null
    return Math.max(0.5, Math.min(7, Math.round((sum / wsum) * 10) / 10))
  }

  let graine = 42
  const rnd = (n) => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n }

  for (let t = 0; t < 500; t++) {
    const brut = {}
    for (const q of QUIZ_QUESTIONS) {
      if (q.inputType === 'scale') { brut[q.id] = 1 + rnd(10); continue }
      brut[q.id] = rnd(q.options.length)
    }
    assert.equal(computeLevel(brut), reference(brut), `tirage ${t}`)
  }
})
