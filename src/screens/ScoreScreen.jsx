import { useState, useCallback, useMemo } from 'react';
import { COURT, Ornament, PadelSlider, GlossaryCard, renderWithGlossary } from '../components/CourtUI';
import { QUIZ_QUESTIONS, GLOSSARY, computeLevel, scaleToLevel } from '../data/courtData';
import { track } from '../analytics';

// ─── Groupe 1 « ressenti » : curseur 1-10 ────────────────────────────────────
// Composant à part, monté avec `key={q.id}` par l'appelant : remonter le
// composant à chaque nouvelle question réinitialise `val` naturellement (pas
// besoin d'un useEffect pour resynchroniser un state gardé au niveau parent).
function ScaleInput({ q, lang, dark, onSubmit }) {
  const [val, setVal] = useState(Math.floor((q.scaleMin + q.scaleMax) / 2));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 8 }}>
      <PadelSlider
        min={q.scaleMin} max={q.scaleMax} step={1}
        value={val}
        onChange={setVal}
        dark={dark} lang={lang}
        bigValue
        suffix={`/${q.scaleMax}`}
        leftLabel={q.scaleMinLabel?.[lang] || q.scaleMinLabel?.fr}
        rightLabel={q.scaleMaxLabel?.[lang] || q.scaleMaxLabel?.fr}
      />
      <button onClick={() => onSubmit(scaleToLevel(val))} style={{
        padding: '15px 0', width: '100%', borderRadius: 999,
        background: COURT.green, color: COURT.cream, border: 'none', cursor: 'pointer',
        fontFamily: 'Spectral, serif', fontStyle: lang === 'he' ? 'normal' : 'italic', fontSize: 17,
      }}>
        {lang === 'he' ? 'המשך' : lang === 'en' ? 'Continue' : 'Continuer'}
      </button>
    </div>
  );
}

// ─── Questions bonus : grille 2×2 (cartes crème, sélection vert + pastille or) ─
// Cartes unifiées : fond blanc/crème + pastille verte par défaut, et au clic la
// carte choisie passe en vert plein avec pastille or — le reste garde son état
// neutre. Petit délai avant d'avancer (comme le mockup) pour que l'utilisateur
// voie sa sélection avant la transition vers la question suivante.
// Définie au niveau module : un composant recréé à chaque rendu est vu par
// React comme un TYPE différent et remonte le sous-arbre à chaque frappe.
function BonusGrid({ q, lang, dark, onPick }) {
  const [selected, setSelected] = useState(null);
  // Contours hairline seuls, aucune couleur de fond tant que rien n'est
  // choisi : la carte reste crème/blanche dans les deux états, seule la
  // pastille + le contour changent à la sélection (contour or, pastille
  // remplie or au lieu du cercle vert vide).
  const card       = dark ? COURT.darkCard   : '#ffffff';
  const ink        = dark ? COURT.darkText   : COURT.ink;
  const border     = dark ? COURT.darkBorder : 'rgba(31,92,63,0.2)';

  const pick = (i, val) => {
    if (selected != null) return; // évite un double-clic pendant la transition
    setSelected(i);
    // Bonne réponse → 7 ; mauvaise → undefined, ce qui laisse la question hors
    // de `answers` (aucun effet sur le niveau).
    setTimeout(() => onPick(val), 260);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, overflow: 'auto' }}>
      {q.options.map((opt, i) => {
        const isSel = selected === i;
        return (
          <button
            key={i}
            onClick={() => pick(i, opt.correct ? 7 : undefined)}
            style={{
              borderRadius: 18, padding: '22px 14px', minHeight: 140,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              cursor: 'pointer', textAlign: 'center',
              background: card,
              border: `${isSel ? 1.5 : 0.5}px solid ${isSel ? COURT.gold : border}`,
              transition: 'border-color 0.2s ease, border-width 0.2s ease',
              animation: `cardIn 0.4s ease ${i * 0.06}s both`,
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 15, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Mulish', fontSize: 13, fontWeight: 700,
              background: isSel ? COURT.gold : 'transparent',
              border: isSel ? 'none' : `1.5px solid ${COURT.green}`,
              color:  isSel ? COURT.greenDeep : COURT.green,
            }}>{'ABCD'[i]}</span>
            <span style={{
              fontFamily: 'Mulish, sans-serif', fontWeight: 600,
              fontSize: 16.5, lineHeight: 1.35,
              color: ink,
            }}>
              {opt[lang] || opt.en || opt.fr}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Quiz principal ───────────────────────────────────────────────────────────
export default function QuizScreen({ t, lang, onDone, onBack, dark, playerFirstName }) {
  const [idx, setIdx]           = useState(0);
  const [answers, setAnswers]   = useState({});
  const [animDir, setAnimDir]   = useState('in');
  const [glossaryKey, setGlossaryKey] = useState(null); // terme ouvert dans le tooltip
  // Mode « évaluer un partenaire » → on retire les ancres objectives (selfOnly) :
  // on ne connaît pas l'ancienneté/fréquence de quelqu'un d'autre, on ne juge
  // que ce qu'on l'a vu jouer (les 10 questions techniques).
  const isPeerEval = !!playerFirstName;
  const questions = useMemo(
    () => QUIZ_QUESTIONS.filter(qq => !(isPeerEval && qq.selfOnly)),
    [isPeerEval]
  );
  const total = questions.length;
  const q = questions[idx];
  const progress = ((idx + 1) / total) * 100;
  const rtl = lang === 'he';

  // Résout le texte d'une question
  const txt = (obj) => {
    if (!obj) return '';
    const base = playerFirstName && q?.qEval
      ? (q.qEval[lang] || q.qEval.fr)
      : (obj[lang] || obj.en || obj.fr);
    return playerFirstName ? base.replace(/\{name\}/g, playerFirstName) : base;
  };
  const subTxt = (opt) => lang === 'he' ? opt.subHe : (lang === 'en' ? (opt.subEn || opt.subFr) : opt.subFr);

  const openGlossary = useCallback((key) => setGlossaryKey(key), []);

  const bg     = dark ? COURT.darkBg   : COURT.cream;
  const ink    = dark ? COURT.darkText  : COURT.ink;
  const stone  = dark ? COURT.darkMuted : COURT.stone;
  const border = dark ? COURT.darkBorder: `${COURT.green}50`;

  // `val === undefined` → on laisse la question HORS de `answers`. computeLevel
  // l'ignore alors totalement (ni au numérateur ni au dénominateur), exactement
  // comme une question jamais répondue. C'est le mécanisme des bonus ratés :
  // se tromper doit être strictement neutre, pas pénalisant.
  // Le `delete` compte : sans lui, revenir en arrière sur un bonus réussi puis
  // répondre faux laisserait le 7 précédent en place.
  const advance = (val) => {
    const newAnswers = { ...answers };
    if (val === undefined) delete newAnswers[q.id];
    else newAnswers[q.id] = val;
    setAnswers(newAnswers);
    setAnimDir('out');
    setTimeout(() => {
      if (idx + 1 >= total) {
        const lvl = computeLevel(newAnswers);
        track('quiz_completed', { level: lvl, answered_count: Object.keys(newAnswers).length });
        onDone(lvl, newAnswers);
      } else {
        setIdx(idx + 1);
        setAnimDir('in');
      }
    }, 280);
  };

  const goBack = () => {
    if (idx === 0) { if (onBack) onBack(); return; }
    setAnimDir('out');
    setTimeout(() => { setIdx(i => i - 1); setAnimDir('in'); }, 220);
  };

  // Texte de la question pour la langue courante
  const questionText = txt(q.q);

  // Les énoncés vont de ~40 à ~200 caractères (ceux qui décrivent un geste en
  // langage simple sont longs). À taille fixe, sur un écran court type iPhone SE,
  // le bloc question repoussait la 4e option sous la ligne de flottaison — or
  // c'est l'option la plus haute : si elle passe inaperçue, les joueurs se
  // sous-évaluent et le niveau calculé dérive vers le bas.
  const qFontSize = questionText.length > 140 ? 19 : questionText.length > 80 ? 22 : 26;

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: bg,
      display: 'flex', flexDirection: 'column', padding: '70px 28px 30px',
    }}>
      {/* Bouton retour */}
      <button onClick={goBack} aria-label={t.back} style={{
        position: 'absolute', top: 18, [rtl ? 'right' : 'left']: 18,
        width: 36, height: 36, borderRadius: 18,
        background: bg, border: `0.5px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: COURT.green, zIndex: 5,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: rtl ? 'scaleX(-1)' : 'none' }}>
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Barre de progression */}
      <div style={{ position: 'absolute', top: 60, left: 70, right: 70, height: 1.5, background: `${COURT.green}25`, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: COURT.green, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontFamily: 'Mulish', fontSize: 13, color: stone, marginTop: 14, marginBottom: 20 }}>
        {t.quizQ} {idx + 1} {t.of} {total}
      </div>

      {/* Corps animé */}
      <div key={idx} style={{
        animation: animDir === 'in' ? 'slideInRight 0.4s ease' : 'slideOutLeft 0.3s ease forwards',
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Question avec termes cliquables */}
        <div style={{
          fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
          fontSize: qFontSize, fontWeight: 500, color: ink, lineHeight: 1.3, marginBottom: 6,
        }}>
          {renderWithGlossary(questionText, lang, openGlossary)}
        </div>

        {/* Indication discrète si des termes sont cliquables */}
        {GLOSSARY?.some(g => {
          const term = (g.term[lang] || g.term.fr).toLowerCase();
          return questionText.toLowerCase().includes(term);
        }) && (
          <div style={{
            fontFamily: 'Mulish', fontSize: 13, color: COURT.green,
            marginBottom: 4, opacity: 0.7,
          }}>
            {lang === 'he' ? '← לחץ על המילה הירוקה להסבר'
              : lang === 'en' ? '← tap the green word for definition'
              : '← touche le mot vert pour une définition'}
          </div>
        )}

        {q.sub && (
          <div style={{
            fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
            fontStyle: rtl ? 'normal' : 'italic', fontSize: 13, color: stone, marginBottom: 18,
          }}>{txt(q.sub)}</div>
        )}
        <Ornament width={50} style={{ marginBottom: 20 }} />

        {/* Réponses */}
        {q.inputType === 'scale' ? (
          <ScaleInput key={q.id} q={q} lang={lang} dark={dark} onSubmit={advance} />
        ) : q.type === 'bonus' ? (
          <BonusGrid key={q.id} q={q} lang={lang} dark={dark} onPick={advance} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => advance(opt.value)} style={{
                textAlign: rtl ? 'right' : 'left', padding: '14px 16px',
                background: dark ? COURT.darkCard : COURT.cream,
                border: `0.5px solid ${border}`, borderRadius: 10, cursor: 'pointer',
                transition: 'all 0.25s ease', animation: `cardIn 0.4s ease ${i * 0.06}s both`,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = COURT.green; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif', fontSize: 17, color: ink, fontWeight: 500 }}>
                  {opt[lang] || opt.en || opt.fr}
                </div>
                <div style={{ fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic', fontSize: 12.5, color: stone, marginTop: 2 }}>
                  {subTxt(opt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Carte glossaire (bottom sheet) */}
      {glossaryKey && (
        <GlossaryCard
          termKey={glossaryKey}
          lang={lang}
          dark={dark}
          onClose={() => setGlossaryKey(null)}
        />
      )}
    </div>
  );
}
