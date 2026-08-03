import { useState, useCallback, useMemo } from 'react';
import { COURT, Ornament, PadelSlider } from '../components/CourtUI';
import { QUIZ_QUESTIONS, GLOSSARY, computeLevel, scaleToLevel } from '../data/courtData';

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
        dark={dark}
        bigValue
        suffix={`/${q.scaleMax}`}
        leftLabel={q.scaleMinLabel?.[lang] || q.scaleMinLabel?.fr}
        rightLabel={q.scaleMaxLabel?.[lang] || q.scaleMaxLabel?.fr}
      />
      <button onClick={() => onSubmit(scaleToLevel(val))} style={{
        padding: '15px 0', width: '100%', borderRadius: 999,
        background: COURT.green, color: COURT.cream, border: 'none', cursor: 'pointer',
        fontFamily: 'Spectral, serif', fontStyle: 'italic', fontSize: 17,
      }}>
        {lang === 'he' ? 'המשך' : lang === 'en' ? 'Continue' : 'Continuer'}
      </button>
    </div>
  );
}

// ─── Questions bonus : grille 2×2 façon jeu télévisé ─────────────────────────
// Grille droite plutôt que le losange en rotation du format TV : sur ~375px de
// large, un losange écraserait le texte des options (jusqu'à ~50 caractères).
// Les 4 pastilles A/B/C/D portent l'information autant que la couleur — un
// daltonien distingue quand même les cases.
// Définie au niveau module : un composant recréé à chaque rendu est vu par
// React comme un TYPE différent et remonte le sous-arbre à chaque frappe.
const BONUS_TILES = [
  { label: 'A', bg: COURT.green,      fg: COURT.cream },
  { label: 'B', bg: COURT.purple,     fg: COURT.cream },
  { label: 'C', bg: COURT.gold,       fg: COURT.ink   },
  { label: 'D', bg: COURT.greenLight, fg: COURT.cream },
];

function BonusGrid({ q, lang, rtl, onPick }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, overflow: 'auto',
    }}>
      {q.options.map((opt, i) => {
        const tile = BONUS_TILES[i] || BONUS_TILES[0];
        return (
          <button
            key={i}
            // Bonne réponse → 7 ; mauvaise → undefined, ce qui laisse la
            // question hors de `answers` (aucun effet sur le niveau).
            onClick={() => onPick(opt.correct ? 7 : undefined)}
            style={{
              // minHeight plutôt qu'aspectRatio strict : les options les plus
              // longues (~50 caractères) doivent pouvoir tenir sans être coupées.
              minHeight: 108,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 10px',
              background: tile.bg, color: tile.fg,
              border: 'none', borderRadius: 12, cursor: 'pointer',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
              animation: `cardIn 0.4s ease ${i * 0.06}s both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 11, flexShrink: 0,
              background: `${tile.fg}2E`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Mulish', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            }}>{tile.label}</span>
            <span style={{
              fontFamily: rtl ? 'Mulish, sans-serif' : 'Spectral, serif',
              fontSize: 13.5, lineHeight: 1.3, textAlign: 'center', fontWeight: 500,
            }}>
              {opt[lang] || opt.en || opt.fr}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Rendu de texte avec termes du glossaire cliquables ──────────────────────
// Parcourt le texte, détecte les termes du glossaire (pour la langue courante)
// et les entoure d'un <span> vert/souligné cliquable.
function renderWithGlossary(text, lang, onTermClick) {
  if (!text || !GLOSSARY?.length) return text;

  // Collecte les termes pour la langue courante + leurs clés de glossaire
  const termMap = GLOSSARY.map(entry => ({
    display: entry.term[lang] || entry.term.fr,
    key: entry.key,
  })).filter(t => t.display);

  // Trie du plus long au plus court pour éviter les captures partielles
  termMap.sort((a, b) => b.display.length - a.display.length);

  // Construction d'un regex case-insensitive groupant tous les termes
  const escaped = termMap.map(t => t.display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return text;
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(regex);
  return parts.map((part, i) => {
    const match = termMap.find(t => t.display.toLowerCase() === part.toLowerCase());
    if (match) {
      return (
        <span
          key={i}
          onClick={e => { e.stopPropagation(); onTermClick(match.key); }}
          style={{
            color: COURT.green,
            borderBottom: `1.5px dotted ${COURT.green}`,
            cursor: 'pointer',
            fontStyle: 'normal',
          }}
        >{part}</span>
      );
    }
    return part;
  });
}

// ─── Tooltip / carte de définition ───────────────────────────────────────────
function GlossaryCard({ termKey, lang, dark, onClose }) {
  const entry = GLOSSARY?.find(g => g.key === termKey);
  if (!entry) return null;

  const bg     = dark ? COURT.darkCard  : '#FFFDF8';
  const ink    = dark ? COURT.darkText  : COURT.ink;
  const stone  = dark ? COURT.darkMuted : COURT.stone;
  const border = dark ? COURT.darkBorder: `${COURT.green}40`;

  return (
    // Overlay semi-transparent — clic en dehors ferme
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 80,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-end',
        padding: '0 20px 40px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: bg,
          border: `0.5px solid ${border}`,
          borderRadius: 16, padding: '20px 20px 24px',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
          animation: 'fadeUp 0.25s ease',
        }}
      >
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{
            fontFamily: 'Spectral, serif',
            fontSize: 22, fontWeight: 600, color: COURT.green,
            fontStyle: 'italic',
          }}>
            {entry.term[lang] || entry.term.fr}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 14,
              background: `${COURT.green}18`, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COURT.green,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Séparateur */}
        <div style={{ height: 0.5, background: `${COURT.green}30`, marginBottom: 12 }} />

        {/* Définition */}
        <div style={{
          fontFamily: 'Spectral, serif',
          fontStyle: 'italic', fontSize: 15,
          color: ink, lineHeight: 1.6,
        }}>
          {entry.def[lang] || entry.def.fr}
        </div>

        {/* Label "Vocabulaire padel" */}
        <div style={{
          marginTop: 14,
          fontFamily: 'Mulish', fontSize: 9,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: stone,
        }}>
          {lang === 'he' ? 'מילון פאדל' : lang === 'en' ? 'Padel glossary' : 'Vocabulaire padel'}
        </div>
      </div>
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
      <div style={{ fontFamily: 'Mulish', fontSize: 10, color: stone, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 14, marginBottom: 20 }}>
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
            fontFamily: 'Mulish', fontSize: 9, color: COURT.green,
            letterSpacing: '0.14em', textTransform: 'uppercase',
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
          <BonusGrid q={q} lang={lang} rtl={rtl} onPick={advance} />
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
