import { useState } from 'react';
import { COURT, TYPE, CompatRing, GlossaryCard } from './CourtUI';

/**
 * Bloc de scores d'un joueur, hiérarchisé :
 *   • niveau      → chiffre dominant (c'est l'information)
 *   • confiance   → pastille attachée au niveau (elle le qualifie)
 *   • compat      → anneau isolé à droite (seul score qui dépend de qui regarde)
 *
 * Passer compat={null} sur son propre profil (on ne se compare pas à soi-même).
 *
 * peerCount / matchCount ne sont connus que pour l'utilisateur connecté
 * (useTierSignals interroge la DB avec son propre id) : quand ils valent
 * null/undefined, on affiche une phrase générique expliquant le mécanisme
 * plutôt que des zéros trompeurs.
 */
export function LevelBlock({ level, confidence, compat = null, peerCount, matchCount, lang = 'fr', dark }) {
  const [glossaryKey, setGlossaryKey] = useState(null);
  const ink    = dark ? COURT.darkText   : COURT.ink;
  const stone  = dark ? COURT.darkMuted  : COURT.stone;
  const border = dark ? COURT.darkBorder : `${COURT.green}25`;
  const cardBg = dark ? COURT.darkCard   : '#fff';
  const rtl    = lang === 'he';

  // Couleur de l'indice : vert ≥75, doré 50–74, rouge <50
  const confColor = confidence >= 75 ? COURT.green : confidence >= 50 ? COURT.gold : COURT.red;
  const hasCounts = peerCount != null && matchCount != null;

  const L = {
    fr: {
      level: 'Niveau déclaré', confirmed: 'confirmé', withYou: 'Avec toi',
      basis: hasCounts
        ? `Confirmé par ${peerCount} partenaires et ${matchCount} matchs contre un niveau proche.`
        : 'Confirmé par les évaluations de partenaires et les matchs joués contre un niveau proche.',
      compat: 'Compatibilité calculée sur l’écart de niveau, la main et tes préférences de partenaire.',
    },
    en: {
      level: 'Declared level', confirmed: 'confirmed', withYou: 'With you',
      basis: hasCounts
        ? `Confirmed by ${peerCount} partners and ${matchCount} matches at a close level.`
        : 'Confirmed by partner ratings and matches played at a close level.',
      compat: 'Compatibility from level gap, dominant hand and your partner preferences.',
    },
    he: {
      level: 'רמה מוצהרת', confirmed: 'מאושר', withYou: 'איתך',
      basis: hasCounts
        ? `אושר על ידי ${peerCount} שותפים ו-${matchCount} משחקים ברמה דומה.`
        : 'אושר על ידי דירוגי שותפים ומשחקים ברמה דומה.',
      compat: 'התאמה מחושבת לפי פער הרמה, יד דומיננטית והעדפות השותף שלך.',
    },
  }[lang] ?? {};

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      background: cardBg, border: `0.5px solid ${border}`, borderRadius: 16,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, fontWeight: 600, color: stone, marginBottom: 2 }}>
            {L.level}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              fontFamily: 'Spectral, serif', fontStyle: rtl ? 'normal' : 'italic',
              fontSize: TYPE.display, lineHeight: 1, color: dark ? COURT.greenOnDark : COURT.green,
            }}>
              {level != null ? level.toFixed(1) : '—'}
            </div>
            {confidence != null && (
              <div
                onClick={e => { e.stopPropagation(); setGlossaryKey('confidenceRate'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                  background: dark ? COURT.darkBg : '#fff', cursor: 'pointer',
                  border: `0.5px solid ${confColor}b0`, borderRadius: 9999, padding: '5px 11px',
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: confColor }} />
                <span style={{
                  fontFamily: 'Mulish', fontSize: TYPE.micro, fontWeight: 700, color: ink,
                  borderBottom: '1px dotted', paddingBottom: 1,
                }}>
                  {Math.round(confidence)} % {L.confirmed}
                </span>
              </div>
            )}
          </div>
          <p style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, lineHeight: 1.45, color: stone, margin: '8px 0 0' }}>
            {L.basis}
          </p>
        </div>

        {compat != null && (
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <CompatRing size={66} value={compat} rtl={rtl} />
            <div style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, fontWeight: 600, color: stone, marginTop: 6 }}>
              {L.withYou}
            </div>
          </div>
        )}
      </div>

      {compat != null && (
        <>
          <div style={{ height: '0.5px', background: border }} />
          <p style={{ fontFamily: 'Mulish', fontSize: TYPE.micro, lineHeight: 1.5, color: stone, margin: 0 }}>
            {L.compat}
          </p>
        </>
      )}

      {glossaryKey && (
        <GlossaryCard termKey={glossaryKey} lang={lang} dark={dark} onClose={() => setGlossaryKey(null)} />
      )}
    </div>
  );
}
