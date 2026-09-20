import { useMemo, useRef, useState } from 'react';
import { api, apiUpload } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

// Photos de plats reprises depuis Uber Eats, Deliveroo ou Takeaway.
//
// Ces plateformes refusent toute lecture depuis le serveur Fairide (403, vérifié — voir platformImages.js
// côté serveur). La page vient donc du navigateur du restaurateur : il l'enregistre (Ctrl+S) ou copie son
// code source, la dépose ici, le serveur en tire les produits (nom + photo) et les apparie aux plats.
//
// Deux modes :
//  - « menu » (défaut) : les plats sont ceux de la carte en base (items = restaurant.menu). L'appariement
//    revient avec parse, et « Appliquer » écrit les photos via /platform-images/apply (réhébergées sur
//    Cloudinary côté serveur), plus les images de section proposées.
//  - « review » : les plats sont ceux d'une relecture d'import (MenuImportReview), pas encore en base.
//    parse lit la page, /platform-images/match apparie sur des clés arbitraires, et onMatched(assignments)
//    rend les photos au parent qui les pose sur ses lignes — rien n'est écrit ici.
const ACCEPT = '.html,.htm,.mhtml,.mht,.txt,text/html,multipart/related';
const MAX_OCTETS = 15 * 1024 * 1024; // même plafond que le serveur (pagePlateformeUpload)
const SEUIL_SUR = 0.8; // en dessous, la ligne est « probable » (et décochée par défaut en mode menu)

const tailleLisible = (o) => (o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
const NOMS_PLATEFORME = { ubereats: 'Uber Eats', deliveroo: 'Deliveroo', takeaway: 'Takeaway' };

export default function PlatformPhotosImport({ restoId, token, items = [], sections = [], mode = 'menu', onApplied, onMatched, onClose }) {
  const { t } = useLanguage();
  const toast = useToast();
  const entree = useRef(null);
  const [fichier, setFichier] = useState(null);
  const [source, setSource] = useState('');
  const [analysant, setAnalysant] = useState(false);
  const [appliquant, setAppliquant] = useState(false);
  const [resultat, setResultat] = useState(null); // { platform, products, matches: [{ key, itemName, productName, imageUrl, score, checked }], unmatched: [{ key, itemName, choix }] }
  const [ecraser, setEcraser] = useState(false);
  const [sectionsExclues, setSectionsExclues] = useState(() => new Set());

  const enRelecture = mode === 'review';
  const cle = (it) => (enRelecture ? it.key : it.id);
  const parCle = useMemo(() => new Map(items.map((it) => [String(cle(it)), it])), [items, enRelecture]); // eslint-disable-line react-hooks/exhaustive-deps

  function choisirFichier(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.size > MAX_OCTETS) { toast(t('platformPhotos.tooBig')); return; }
    setFichier(f); setSource('');
  }

  // Lecture de la page, puis appariement. En mode menu le serveur apparie lui-même avec la carte en base ;
  // en relecture on lui envoie les lignes relues (clé + nom) pour un appariement pur (/match).
  async function analyser() {
    const texte = source.trim();
    if (!fichier && texte.length < 200) { toast(t('platformPhotos.nothingToAnalyze')); return; }
    if (!fichier && texte.length > MAX_OCTETS) { toast(t('platformPhotos.tooBig')); return; }
    setAnalysant(true);
    try {
      const r = fichier
        ? await apiUpload(`/restaurants/${restoId}/menu/platform-images/parse`, { file: fichier, token, fieldName: 'file' })
        : await api(`/restaurants/${restoId}/menu/platform-images/parse`, { method: 'POST', token, body: { html: texte } });
      let brutes;
      if (enRelecture) {
        const lignes = items.filter((it) => it.name?.trim()).map((it) => ({ key: it.key, name: it.name }));
        const m = lignes.length ? await api(`/restaurants/${restoId}/menu/platform-images/match`, { method: 'POST', token, body: { products: r.products, items: lignes } }) : { matches: [] };
        brutes = m.matches.map((x) => ({ ...x, key: x.key }));
      } else {
        brutes = r.matches.map((x) => ({ ...x, key: x.itemId }));
      }
      // Relecture : tout ce qui est reconnu (≥ 0,6) est coché, le restaurateur décoche. Carte en base : seules
      // les correspondances sûres (≥ 0,8) sont cochées d'office — on écrit en base, mieux vaut relire le reste.
      const matches = brutes.map((x) => ({ ...x, checked: enRelecture ? true : x.score >= SEUIL_SUR }));
      const reconnus = new Set(matches.map((x) => String(x.key)));
      const unmatched = items.filter((it) => !reconnus.has(String(cle(it)))).map((it) => ({ key: cle(it), itemName: it.name, choix: '' }));
      setResultat({ platform: r.platform, products: r.products, matches, unmatched });
      setSectionsExclues(new Set());
    } catch (e) {
      toast(e.message);
    } finally {
      setAnalysant(false);
    }
  }

  function cocher(key, checked) { setResultat((res) => ({ ...res, matches: res.matches.map((m) => (String(m.key) === String(key) ? { ...m, checked } : m)) })); }
  function toutCocher() {
    setResultat((res) => { const tous = res.matches.every((m) => m.checked); return { ...res, matches: res.matches.map((m) => ({ ...m, checked: !tous })) }; });
  }
  function choisir(key, imageUrl) { setResultat((res) => ({ ...res, unmatched: res.unmatched.map((u) => (String(u.key) === String(key) ? { ...u, choix: imageUrl } : u)) })); }

  // Toutes les affectations retenues : lignes cochées + choix manuels.
  const affectations = useMemo(() => {
    if (!resultat) return [];
    return [
      ...resultat.matches.filter((m) => m.checked).map((m) => ({ key: m.key, imageUrl: m.imageUrl })),
      ...resultat.unmatched.filter((u) => u.choix).map((u) => ({ key: u.key, imageUrl: u.choix }))
    ];
  }, [resultat]);

  // Image de section proposée : la photo du premier plat retenu de la section, pour les sections sans image.
  const sectionsProposees = useMemo(() => {
    if (!resultat || enRelecture) return [];
    const out = [];
    for (const s of sections) {
      if (!s?.name || s.imageUrl) continue;
      const premiere = affectations.find((a) => (parCle.get(String(a.key))?.category || 'plat') === s.name);
      if (premiere) out.push({ name: s.name, imageUrl: premiere.imageUrl });
    }
    return out;
  }, [resultat, sections, affectations, parCle, enRelecture]);

  async function appliquer() {
    if (!affectations.length) { toast(t('platformPhotos.nothingSelected')); return; }
    if (enRelecture) {
      onMatched?.(affectations);
      toast(t('platformPhotos.reviewApplied', { n: affectations.length }));
      onClose?.();
      return;
    }
    setAppliquant(true);
    try {
      const sectionImages = Object.fromEntries(sectionsProposees.filter((s) => !sectionsExclues.has(s.name)).map((s) => [s.name, s.imageUrl]));
      const r = await api(`/restaurants/${restoId}/menu/platform-images/apply`, {
        method: 'POST', token,
        body: { assignments: affectations.map((a) => ({ itemId: a.key, imageUrl: a.imageUrl })), overwrite: ecraser, sectionImages }
      });
      toast(t('platformPhotos.applied', { updated: r.updated, skipped: r.skipped, failed: r.failed }));
      onApplied?.(r);
      recommencer();
    } catch (e) {
      toast(e.message);
    } finally {
      setAppliquant(false);
    }
  }

  function recommencer() { setResultat(null); setFichier(null); setSource(''); setEcraser(false); }

  const nomPlateforme = resultat?.platform ? NOMS_PLATEFORME[resultat.platform] || resultat.platform : '';
  const dejaIllustre = (key) => !enRelecture && !!parCle.get(String(key))?.imageUrl;

  return (
    <div className="platform-photos">
      <p className="small" style={{ margin: '0 0 8px' }}>{t('platformPhotos.intro')}</p>
      {!items.length && <p className="small" style={{ margin: '0 0 8px', color: 'var(--red)' }}>{t('platformPhotos.emptyMenu')}</p>}

      {!resultat && (
        <>
          <ol className="copier-coller-etapes" style={{ marginBottom: 10 }}>
            <li>{t('platformPhotos.step1')}</li>
            <li>{t('platformPhotos.step2')}</li>
            <li>{t('platformPhotos.step3')}</li>
          </ol>
          <input ref={entree} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={choisirFichier} />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className={fichier ? 'btn-outline' : 'btn-teal'} disabled={analysant} onClick={() => entree.current?.click()}>{t('platformPhotos.chooseFile')}</button>
            {fichier && (
              <span className="small">
                📄 <b>{fichier.name}</b> ({tailleLisible(fichier.size)})
                <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12, marginLeft: 6 }} onClick={() => setFichier(null)} aria-label={t('platformPhotos.removeFile')}>✕</button>
              </span>
            )}
          </div>
          {!fichier && (
            <>
              <p className="small" style={{ margin: '10px 0 4px' }}>{t('platformPhotos.orPaste')}</p>
              <textarea rows={4} value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('platformPhotos.pastePlaceholder')} disabled={analysant} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
            </>
          )}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-teal" disabled={analysant || (!fichier && !source.trim())} onClick={analyser}>{analysant ? t('platformPhotos.analyzing') : t('platformPhotos.analyze')}</button>
            {onClose && <button type="button" className="btn-ghost" disabled={analysant} onClick={onClose}>{t('platformPhotos.close')}</button>}
          </div>
        </>
      )}

      {resultat && (
        <div>
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
            ✅ {t('platformPhotos.found', { n: resultat.products.length, platform: nomPlateforme ? t('platformPhotos.onPlatform', { platform: nomPlateforme }) : '' })}
            {' · '}{t('platformPhotos.matched', { n: resultat.matches.length })}
          </p>
          {resultat.matches.length === 0 && <p className="small" style={{ margin: '0 0 8px' }}>{t('platformPhotos.noneMatched')}</p>}

          {resultat.matches.length > 0 && (
            <div className="table-scroll" style={{ marginBottom: 10, overflowX: 'auto' }}>
              <table className="admin-table platform-photos-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" style={{ width: 'auto' }} checked={resultat.matches.every((m) => m.checked)} onChange={toutCocher} aria-label={t('platformPhotos.toggleAll')} /></th>
                    <th>{t('platformPhotos.colPhoto')}</th>
                    <th>{t('platformPhotos.colProduct')}</th>
                    <th>{t('platformPhotos.colItem')}</th>
                    <th>{t('platformPhotos.colScore')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.matches.map((m) => (
                    <tr key={String(m.key)} style={{ opacity: m.checked ? 1 : 0.55 }}>
                      <td><input type="checkbox" style={{ width: 'auto' }} checked={m.checked} onChange={(e) => cocher(m.key, e.target.checked)} /></td>
                      <td><img loading="lazy" src={m.imageUrl} alt="" className="dish-thumb" /></td>
                      <td style={{ whiteSpace: 'normal' }}>{m.productName}</td>
                      <td style={{ whiteSpace: 'normal' }}>
                        <b>{m.itemName}</b>
                        {dejaIllustre(m.key) && <span className="small" style={{ display: 'block', opacity: 0.8 }}>{ecraser ? t('platformPhotos.willOverwrite') : t('platformPhotos.hasPhoto')}</span>}
                      </td>
                      <td><span className={`pill ${m.score >= SEUIL_SUR ? 'teal' : ''}`}>{m.score >= SEUIL_SUR ? t('platformPhotos.sure') : t('platformPhotos.probable')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resultat.unmatched.length > 0 && (
            <details style={{ marginBottom: 10 }} open={resultat.matches.length === 0}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('platformPhotos.unmatchedTitle', { n: resultat.unmatched.length })}</summary>
              <p className="small" style={{ margin: '6px 0 8px' }}>{t('platformPhotos.unmatchedIntro')}</p>
              <div style={{ display: 'grid', gap: 6 }}>
                {resultat.unmatched.map((u) => (
                  <div key={String(u.key)} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {u.choix ? <img loading="lazy" src={u.choix} alt="" className="dish-thumb" /> : <span className="dish-thumb-empty">🍽️</span>}
                    <span style={{ flex: '1 1 160px' }}><b>{u.itemName}</b></span>
                    <select value={u.choix} onChange={(e) => choisir(u.key, e.target.value)} style={{ flex: '1 1 200px', maxWidth: 320 }} aria-label={u.itemName}>
                      <option value="">{t('platformPhotos.noPhoto')}</option>
                      {resultat.products.map((p) => <option key={p.name} value={p.imageUrl}>{p.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </details>
          )}

          {sectionsProposees.length > 0 && (
            <div className="card" style={{ marginBottom: 10, padding: 12 }}>
              <b>{t('platformPhotos.sectionsTitle')}</b>
              <p className="small" style={{ margin: '4px 0 8px' }}>{t('platformPhotos.sectionsIntro')}</p>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                {sectionsProposees.map((s) => (
                  <label key={s.name} className="row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={!sectionsExclues.has(s.name)} onChange={(e) => setSectionsExclues((prev) => { const n = new Set(prev); if (e.target.checked) n.delete(s.name); else n.add(s.name); return n; })} />
                    <img loading="lazy" src={s.imageUrl} alt="" className="dish-thumb" />
                    <span className="small"><b>{s.name}</b></span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn-teal" disabled={appliquant || !affectations.length} onClick={appliquer}>
              {appliquant ? t('platformPhotos.applying') : enRelecture ? t('platformPhotos.useInReview', { n: affectations.length }) : t('platformPhotos.apply', { n: affectations.length })}
            </button>
            {!enRelecture && (
              <label className="row small" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={ecraser} onChange={(e) => setEcraser(e.target.checked)} />
                {t('platformPhotos.overwrite')}
              </label>
            )}
            <button type="button" className="btn-ghost" disabled={appliquant} onClick={recommencer}>{t('platformPhotos.restart')}</button>
            {onClose && <button type="button" className="btn-ghost" disabled={appliquant} onClick={onClose}>{t('platformPhotos.close')}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
