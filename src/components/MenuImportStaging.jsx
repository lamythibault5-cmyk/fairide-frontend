import { useRef, useState } from 'react';
import { apiUpload } from '../api';
import { useLanguage } from '../context/LanguageContext';

// Import de menu en deux temps. 1) Le restaurateur dépose TOUS ses documents (pages PDF, photos), en peut
// ajouter, en retirer, et voit une estimation du temps de lecture. 2) L'analyse tourne page par page, avec
// l'avancement (« document 2 sur 5 »), un bilan par page — plats trouvés, page trop chargée, page illisible —
// puis tous les plats fusionnés partent dans la liste de relecture (MenuImportReview) via onDone(items).
const MAX_DOCS = 25; // une carte complète tient rarement sur plus de 25 pages ou photos
const CONCURRENCE = 2; // deux documents lus en parallèle : une carte de 25 pages reste sous les ~20 min
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
            <b>{b.name}</b> · {b.status === 'ok' && t('menuPage.stagingPageOk', { n: b.count })}
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
  const [termines, setTermines] = useState(0); // documents déjà lus (les lectures avancent par paquets de CONCURRENCE)
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

  // Les documents partent CONCURRENCE par CONCURRENCE : l'attente annoncée tient compte de ce parallélisme.
  const estimation = (n) => {
    const paquets = Math.ceil(Math.max(0, n) / CONCURRENCE);
    const min = Math.max(1, Math.round((paquets * SECONDES_PAR_DOC[0]) / 60)); const max = Math.max(min + (n > 1 ? 1 : 0), Math.round((paquets * SECONDES_PAR_DOC[1]) / 60));
    return { min, max };
  };

  async function analyser() {
    if (!fichiers.length) return;
    setEtat('analyse'); setBilans([]); setTermines(0); onBusy?.(true);
    // Pool de CONCURRENCE lectures simultanées : chaque document part seul vers import-preview, et les
    // bilans restent rangés dans l'ordre de dépôt même si les réponses reviennent dans le désordre.
    const resultats = new Array(fichiers.length);
    let suivant = 0; let faits = 0;
    // Le bilan affiche seulement le resume par document : les plats eux-memes partent dans onDone.
    const sansItems = (r) => ({ name: r.name, status: r.status, count: r.count, message: r.message });
    async function ouvrier() {
      while (suivant < fichiers.length) {
        const i = suivant; suivant += 1;
        const f = fichiers[i];
        try {
          const r = await apiUpload(`/restaurants/${restoId}/menu/import-preview`, { files: [f], token, fieldName: 'files' });
          const items = r.items || [];
          resultats[i] = { name: f.name, status: items.length >= BEAUCOUP_DE_PLATS ? 'trop' : 'ok', count: items.length, items };
        } catch (err) {
          const message = err.message || '';
          resultats[i] = { name: f.name, status: /trop de plats|too many/i.test(message) ? 'trop' : 'echec', count: 0, message, items: [] };
        }
        faits += 1; setTermines(faits); setBilans(resultats.filter(Boolean).map(sansItems));
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCE, fichiers.length) }, () => ouvrier()));
    const tous = []; const vus = new Set();
    for (const r of resultats) {
      for (const it of (r?.items || [])) { const cle = `${it.name.toLowerCase()}|${it.price}`; if (!vus.has(cle)) { vus.add(cle); tous.push(it); } }
    }
    const bilansFinaux = resultats.filter(Boolean).map(sansItems);
    setBilans(bilansFinaux); setEtat('termine'); onBusy?.(false);
    if (tous.length) onDone(tous, bilansFinaux);
  }

  function recommencer() { setFichiers([]); setBilans([]); setTermines(0); setEtat('attente'); }

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
            {fichiers.length > 0 && <span className="small">{t('menuPage.stagingCount', { n: fichiers.length, max: MAX_DOCS })}</span>}
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
              <p style={{ margin: '0 0 6px', fontWeight: 700 }}>⏳ {t('menuPage.stagingProgress', { i: Math.min(termines + 1, fichiers.length), n: fichiers.length, name: fichiers[Math.min(termines, fichiers.length - 1)]?.name || '' })}</p>
              <div className="courier-bar"><div style={{ width: `${Math.round((termines / fichiers.length) * 100)}%` }} /></div>
              <p className="small" style={{ margin: '6px 0 0' }}>{t('menuPage.stagingRemaining', { min: estimation(fichiers.length - termines).min, max: estimation(fichiers.length - termines).max })}</p>
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
