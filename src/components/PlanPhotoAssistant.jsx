import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../api';
import { useLanguage } from '../context/LanguageContext';
import PlanApercu, { AREAS, AREA_ICONS, areaLabel } from './PlanApercu';

// Assistant « plan depuis une photo » : le restaurateur photographie sa salle (une photo par salle, 4 au plus),
// l'assistant IA repère les tables et propose un plan vu du dessus. On montre la proposition — nom, type, tables —
// et on l'applique d'un geste ; tout se corrige ensuite au doigt dans le plan (déplacer, redimensionner, fiche).
// Serveur : POST /restaurants/:id/floor-plan/analyze puis /floor-plan/apply (floorPlanPhoto.js).

const MAX_PHOTOS = 4;
const COTE_MAX = 1600; // les photos de téléphone font 12 Mpx : réduites avant l'envoi, la lecture est plus rapide

// Réduit une photo en JPEG (1600 px de côté au plus). Format que le navigateur ne sait pas lire : on l'envoie tel quel.
function reduire(fichier) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const echelle = Math.min(1, COTE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * echelle); canvas.height = Math.round(img.naturalHeight * echelle);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => { URL.revokeObjectURL(url); resolve(blob ? new File([blob], 'salle.jpg', { type: 'image/jpeg' }) : fichier); }, 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(fichier); };
    img.src = url;
  });
}

// cible : la salle à dessiner (bouton 📷 d'une salle), ou null pour créer des salles depuis plusieurs photos.
export default function PlanPhotoAssistant({ restoId, token, toast, salles, tables, cible = null, onFermer, onApplique }) {
  const { t } = useLanguage();
  const [etape, setEtape] = useState('photos'); // photos | analyse | apercu
  const [photos, setPhotos] = useState([]); // { id, fichier, url, nom }
  const [propositions, setPropositions] = useState([]); // { ok, error, name, kind, summary, tables, cible, remplacer }
  const [secondes, setSecondes] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const galerie = useRef(null); const camera = useRef(null);
  const max = cible ? 1 : MAX_PHOTOS;

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (etape !== 'analyse') return undefined;
    setSecondes(0);
    const i = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [etape]);

  function ajouter(e) {
    const choisis = [...(e.target.files || [])]; e.target.value = '';
    setPhotos((l) => {
      const place = max - l.length;
      if (choisis.length > place) toast(t('floorPlan.aiMaxPhotos', { n: max }));
      const nouvelles = choisis.slice(0, Math.max(0, place)).map((f, i) => ({ id: `${Date.now()}-${i}`, fichier: f, url: URL.createObjectURL(f), nom: cible ? cible.name : '' }));
      return [...l, ...nouvelles];
    });
  }
  function retirer(id) { setPhotos((l) => { const p = l.find((x) => x.id === id); if (p) URL.revokeObjectURL(p.url); return l.filter((x) => x.id !== id); }); }

  async function analyser() {
    if (!photos.length) return;
    setEtape('analyse');
    try {
      /* apiUpload plutôt qu'un fetch à la main : cette route répond du JSON, pas un fichier, donc
         c'est apiUpload et non apiDownload qui convient. Le gain est le même — le traitement
         centralisé du 401 renvoie vers la connexion au lieu d'afficher « l'analyse a échoué » à
         quelqu'un dont la session a simplement expiré pendant qu'il choisissait ses photos.
         `fields` porte la liste des noms ; `files` prend les photos sous le même nom de champ que
         celui attendu par la route. */
      let data;
      try {
        data = await apiUpload(`/restaurants/${restoId}/floor-plan/analyze`, {
          token,
          fieldName: 'photos',
          files: await Promise.all(photos.map((p) => reduire(p.fichier))),
          fields: { names: JSON.stringify(photos.map((p) => p.nom || '')) }
        });
      } catch (err) {
        /* La route répond 422 AVEC des propositions quand aucune photo n'a pu être lue : chacune y
           porte la raison de son échec, et l'écran les affiche une par une. Ce cas n'est donc pas
           une erreur à remonter telle quelle — on reprend le corps attaché à l'erreur (voir api.js).
           Toute autre erreur, 401 compris, continue de remonter normalement. */
        if (!err?.data?.proposals) throw err;
        data = err.data;
      }
      // Première proposition : dans la salle ciblée, ou dans une salle encore vide ; les suivantes, de nouvelles salles.
      const salleVide = salles.find((x) => !(tables || []).some((tb) => tb.roomId === x.id) && !(x.elements || []).length);
      const liste = (data.proposals || []).map((p, i) => ({
        ...p,
        name: cible ? cible.name : p.name,
        kind: cible && !p.ok ? cible.kind : p.kind,
        cible: cible ? cible.id : i === 0 && salleVide ? salleVide.id : '',
        remplacer: !cible && i === 0 && !!salleVide
      }));
      setPropositions(liste);
      setEtape('apercu');
      if (!liste.some((p) => p.ok)) toast(data.error || t('floorPlan.aiError'));
    } catch (e) {
      toast(e.message || t('floorPlan.aiError'));
      setEtape('photos');
    }
  }

  const maj = (i, champs) => setPropositions((l) => l.map((p, k) => (k === i ? { ...p, ...champs } : p)));
  const tablesDe = (salleId) => (tables || []).filter((tb) => tb.roomId === salleId).length;

  async function appliquer() {
    const aCreer = propositions.filter((p) => p.ok && p.tables.length);
    if (!aCreer.length) return;
    setEnvoi(true);
    try {
      const r = await api(`/restaurants/${restoId}/floor-plan/apply`, {
        method: 'POST', token,
        body: { rooms: aCreer.map((p) => ({ roomId: p.cible || undefined, name: p.name, kind: p.kind, replace: !!p.cible && p.remplacer, widthM: p.widthM, depthM: p.depthM, tables: p.tables, elements: p.elements })) }
      });
      onApplique(r);
      toast(t('floorPlan.aiApplied', { n: aCreer.reduce((a, p) => a + p.tables.length, 0) }));
      onFermer();
    } catch (e) { toast(e.message); } finally { setEnvoi(false); }
  }

  const messages = [t('floorPlan.aiStep1'), t('floorPlan.aiStep2'), t('floorPlan.aiStep3')];
  return (
    <div className="card fp-assistant" role="dialog" aria-label={t('floorPlan.aiTitle')}>
      <div className="fp-assistant-tete">
        <b>✨ {cible ? t('floorPlan.aiTitleRoom', { name: cible.name }) : t('floorPlan.aiTitle')}</b>
        <button type="button" className="btn-ghost" style={{ padding: '2px 8px' }} onClick={onFermer} aria-label={t('floorPlan.close')}>✕</button>
      </div>

      {etape === 'photos' && (
        <>
          <p className="small" style={{ margin: '0 0 8px' }}>{cible ? t('floorPlan.aiIntroRoom') : t('floorPlan.aiIntro', { n: MAX_PHOTOS })}</p>
          <p className="small fp-assistant-conseil">💡 {t('floorPlan.aiTips')}</p>
          <div className="fp-photos">
            {photos.map((p) => (
              <div key={p.id} className="fp-photo">
                <img src={p.url} alt="" />
                <button type="button" className="fp-photo-retirer" onClick={() => retirer(p.id)} aria-label={t('floorPlan.aiRemovePhoto')}>✕</button>
                {!cible && <input aria-label={t('floorPlan.aiRoomNamePh')} value={p.nom} maxLength={40} placeholder={t('floorPlan.aiRoomNamePh')} onChange={(e) => setPhotos((l) => l.map((x) => (x.id === p.id ? { ...x, nom: e.target.value } : x)))} />}
              </div>
            ))}
            {photos.length < max && (
              <div className="fp-photo-ajout">
                <button type="button" className="btn-teal" onClick={() => camera.current?.click()}>📷 {t('floorPlan.aiTakePhoto')}</button>
                <button type="button" className="btn-outline" onClick={() => galerie.current?.click()}>🖼️ {t('floorPlan.aiChoosePhotos')}</button>
              </div>
            )}
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={ajouter} />
          <input ref={galerie} type="file" accept="image/*" multiple={!cible} style={{ display: 'none' }} onChange={ajouter} />
          <div className="fp-actions" style={{ marginTop: 10 }}>
            <button type="button" className="btn-teal" disabled={!photos.length} onClick={analyser}>✨ {t('floorPlan.aiDraw')}</button>
          </div>
        </>
      )}

      {etape === 'analyse' && (
        <div className="fp-assistant-attente" aria-live="polite">
          <span className="fp-assistant-roue" aria-hidden="true" />
          <b>{messages[Math.floor(secondes / 6) % messages.length]}</b>
          <span className="small">{t('floorPlan.aiWait', { s: secondes })}</span>
        </div>
      )}

      {etape === 'apercu' && (
        <>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('floorPlan.aiPreviewIntro')}</p>
          {propositions.map((p, i) => (
            <div key={i} className="fp-proposition">
              {!p.ok ? (
                <p className="small" style={{ color: 'var(--red)', margin: 0 }}>{t('floorPlan.aiPhotoFailed', { n: i + 1 })} {p.error}</p>
              ) : (
                <>
                  <div className="fp-champs">
                    <div className="fp-large">
                      <label htmlFor={`fp-nom-${i}`}>{t('floorPlan.aiRoomName')}</label>
                      <input id={`fp-nom-${i}`} value={p.name} maxLength={40} onChange={(e) => maj(i, { name: e.target.value })} />
                    </div>
                    <div className="fp-large">
                      <span className="titre-groupe" id={`fp-type-titre-${i}`}>{t('floorPlan.roomKind')}</span>
                      <div className="fp-types" role="group" aria-labelledby={`fp-type-titre-${i}`}>
                        {AREAS.map((a) => (
                          <button type="button" key={a} className={`chip${p.kind === a ? ' active' : ''}`} onClick={() => maj(i, { kind: a })}>{AREA_ICONS[a]} {areaLabel(t, a)}</button>
                        ))}
                      </div>
                    </div>
                    {!cible && salles.length > 0 && (
                      <div className="fp-large">
                        <label htmlFor={`fp-cible-${i}`}>{t('floorPlan.aiTarget')}</label>
                        <select id={`fp-cible-${i}`} value={p.cible} onChange={(e) => maj(i, { cible: e.target.value })}>
                          <option value="">{t('floorPlan.aiNewRoom')}</option>
                          {salles.map((s) => <option key={s.id} value={s.id}>{AREA_ICONS[s.kind]} {s.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <PlanApercu widthM={p.widthM} depthM={p.depthM} kind={p.kind} tables={p.tables} elements={p.elements} t={t} />
                  <p className="small" style={{ margin: '6px 0 0' }}>
                    {t('floorPlan.aiFound', { n: p.tables.length, seats: p.tables.reduce((a, tb) => a + tb.seats, 0), w: p.widthM, d: p.depthM })}{p.summary ? ` — ${p.summary}` : ''}
                  </p>
                  {p.cible && (tablesDe(p.cible) > 0 || !cible) && (
                    <label className="fp-case" style={{ marginTop: 6 }}>
                      <input type="checkbox" checked={p.remplacer} onChange={(e) => maj(i, { remplacer: e.target.checked })} />
                      <span>{tablesDe(p.cible) > 0 ? t('floorPlan.aiReplace', { n: tablesDe(p.cible) }) : t('floorPlan.tplReplaceEmpty')}</span>
                    </label>
                  )}
                </>
              )}
            </div>
          ))}
          <div className="fp-actions" style={{ marginTop: 10 }}>
            <button type="button" className="btn-teal" disabled={envoi || !propositions.some((p) => p.ok && p.tables.length)} onClick={appliquer}>{envoi ? '…' : `✅ ${t('floorPlan.aiApply')}`}</button>
            <button type="button" className="btn-ghost" disabled={envoi} onClick={() => { setPropositions([]); setEtape('photos'); }}>{t('floorPlan.aiRetake')}</button>
          </div>
          <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('floorPlan.aiAfterHint')}</p>
        </>
      )}
    </div>
  );
}
