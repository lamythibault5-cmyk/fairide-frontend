import { useRef, useState } from 'react';
import { apiUpload } from '../api';
import { useLanguage } from '../context/LanguageContext';

// Import de menu en deux temps. 1) Le restaurateur dépose TOUS ses documents (pages PDF, photos), en peut
// ajouter, en retirer, et voit une estimation du temps de lecture. 2) L'analyse tourne page par page, avec
// l'avancement (« document 2 sur 5 »), un bilan par page — plats trouvés, page trop chargée, page illisible —
// puis tous les plats fusionnés partent dans la liste de relecture (MenuImportReview) via onDone(items).
const MAX_DOCS = 12;
const SECONDES_PAR_DOC = [45, 100]; // fourchette observée par document (Claude lit un PDF ou une photo)
const BEAUCOUP_DE_PLATS = 45; // au-delà, on invite à vérifier qu'il ne manque rien sur cette page

function tailleLisible(o) { return o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`; }

export function MenuImportReport({ bilans }) {
  const { t } = useLanguage();
  if (!bilans?.length) return null;
  return (
    <ul className="menu-staging-list" style={{ marginTop: 8 }}>
      {bilans.map((b, i) => (
        <li key={`${b.name}-${i}`}>
          <span className="menu-staging-icon" aria-hidden="true">{b.status === 'ok' ? '✅' : b.status === 'trop' ? '⚠️' : '❌'}</span>
          <span className="menu-staging-name">
            <b>{b.name}</b> — {b.status === 'ok' && t('menuPage.stagingPageOk', { n: b.count })}
            {b.status === 'trop' && (b.count ? t('menuPage.stagingPageMany', { n: b.count }) : t('menuPage.stagingPageTooMany'))}
            {b.status === 'echec' && (b.message || t('menuPage.stagingPageFail'))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function MenuImportStaging({ restoId, token, onDone, onBusy, disabled = false }) {
  const { t } = useLanguage();
  const [fichiers, setFichiers] = useState([]);
  const [etat, setEtat] = useState('attente'); // attente | analyse | termine
  const [index, setIndex] = useState(0);
  const [bilans, setBilans] = useState([]); // [{ name, status: 'ok'|'trop'|'echec', count, message }]
  const entree = useRef(null);

  function ajouter(e) {
    const nouveaux = [...(e.target.files || [])]; e.target.value = '';
    setFichiers((f) => {
      const cles = new Set(f.map((x) => `${x.name}|${x.size}`));
      return [...f, ...nouveaux.filter((x) => !cles.has(`${x.name}|${x.size}`))].slice(0, MAX_DOCS);
    });
  }
  function retirer(i) { setFichiers((f) => f.filter((_, k) => k !== i)); }

  const estimation = (n) => {
    const min = Math.max(1, Math.round((n * SECONDES_PAR_DOC[0]) / 60)); const max = Math.max(min + (n > 1 ? 1 : 0), Math.round((n * SECONDES_PAR_DOC[1]) / 60));
    return { min, max };
  };

  async function analyser() {
    if (!fichiers.length) return;
    setEtat('analyse'); setBilans([]); onBusy?.(true);
    const tous = []; const vus = new Set(); const resultats = [];
    for (let i = 0; i < fichiers.length; i++) {
      setIndex(i);
      const f = fichiers[i];
      try {
        const r = await apiUpload(`/restaurants/${restoId}/menu/import-preview`, { files: [f], token, fieldName: 'files' });
        const items = r.items || [];
        for (const it of items) { const cle = `${it.name.toLowerCase()}|${it.price}`; if (!vus.has(cle)) { vus.add(cle); tous.push(it); } }
        resultats.push({ name: f.name, status: items.length >= BEAUCOUP_DE_PLATS ? 'trop' : 'ok', count: items.length });
      } catch (err) {
        const message = err.message || '';
        resultats.push({ name: f.name, status: /trop de plats|too many/i.test(message) ? 'trop' : 'echec', count: 0, message });
      }
      setBilans([...resultats]);
    }
    setEtat('termine'); onBusy?.(false);
    if (tous.length) onDone(tous, resultats);
  }

  function recommencer() { setFichiers([]); setBilans([]); setEtat('attente'); }

  const est = estimation(fichiers.length);
  return (
    <div className="menu-staging">
      <input ref={entree} type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={ajouter} />
      {etat === 'attente' && (
        <>
          <p className="small" style={{ margin: '0 0 8px' }}><b>1.</b> {t('menuPage.stagingStep1')}</p>
          {fichiers.length > 0 && (
            <ul className="menu-staging-list">
              {fichiers.map((f, i) => (
                <li key={`${f.name}-${f.size}`}>
                  <span className="menu-staging-icon" aria-hidden="true">{f.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                  <span className="menu-staging-name">{f.name} <span className="small">({tailleLisible(f.size)})</span></span>
                  <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => retirer(i)} aria-label={t('menuPage.stagingRemove')}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className={fichiers.length ? 'btn-outline' : 'btn-teal'} disabled={disabled || fichiers.length >= MAX_DOCS} onClick={() => entree.current?.click()}>
              {fichiers.length ? t('menuPage.stagingAddMore') : t('menuPage.chooseFiles')}
            </button>
            {fichiers.length > 0 && (
              <button type="button" className="btn-teal" disabled={disabled} onClick={analyser}>
                <b>2.</b> {t('menuPage.stagingAnalyze', { n: fichiers.length })}
              </button>
            )}
          </div>
          {fichiers.length > 0 && (
            <p className="small" style={{ margin: '8px 0 0' }}>
              ⏱️ {t('menuPage.stagingEstimate', { n: fichiers.length, min: est.min, max: est.max })} {t('menuPage.stagingKeepOpen')}
            </p>
          )}
          {fichiers.length >= MAX_DOCS && <p className="small" style={{ margin: '4px 0 0' }}>{t('menuPage.stagingMax', { n: MAX_DOCS })}</p>}
        </>
      )}

      {etat !== 'attente' && (
        <div className="menu-staging-progress" role="status">
          {etat === 'analyse' && (
            <>
              <p style={{ margin: '0 0 6px', fontWeight: 700 }}>⏳ {t('menuPage.stagingProgress', { i: index + 1, n: fichiers.length, name: fichiers[index]?.name || '' })}</p>
              <div className="courier-bar"><div style={{ width: `${Math.round(((index) / fichiers.length) * 100)}%` }} /></div>
              <p className="small" style={{ margin: '6px 0 0' }}>{t('menuPage.stagingRemaining', { min: estimation(fichiers.length - index).min, max: estimation(fichiers.length - index).max })}</p>
            </>
          )}
          <MenuImportReport bilans={bilans} />
          {etat === 'termine' && (
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <p className="small" style={{ margin: 0, flex: '1 1 200px' }}>
                {bilans.some((b) => b.status === 'ok' || (b.status === 'trop' && b.count)) ? t('menuPage.stagingDone') : t('menuPage.stagingNothing')}
              </p>
              <button type="button" className="btn-ghost" onClick={recommencer}>{t('menuPage.stagingRestart')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
