import { useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import PlanApercu, { AREA_ICONS } from './PlanApercu';
import { MODELES, modeleEnPlan, couvertsDe } from './floorPlanTemplates';

// Modèles de salle prêts à l'emploi : on en choisit un, on le nomme, on l'applique (nouvelle salle, ou à la place du
// plan d'une salle existante) ; ensuite tout se modifie au doigt dans le plan. Serveur : POST /floor-plan/apply.
export default function PlanModeles({ restoId, token, toast, salles, tables, cible = null, onFermer, onApplique }) {
  const { t } = useLanguage();
  const [choisi, setChoisi] = useState(null);
  const [nom, setNom] = useState('');
  const salleVide = salles.find((x) => !(tables || []).some((tb) => tb.roomId === x.id) && !(x.elements || []).length);
  const [salleCible, setSalleCible] = useState(cible ? cible.id : salleVide?.id || '');
  const [remplacer, setRemplacer] = useState(!!(cible || salleVide));
  const [envoi, setEnvoi] = useState(false);
  const nbTablesCible = salleCible ? (tables || []).filter((tb) => tb.roomId === salleCible).length : 0;

  function choisir(m) {
    setChoisi(m);
    const existante = salles.find((s) => s.id === salleCible);
    setNom(existante ? existante.name : t(`floorPlan.tplRoom_${m.kind}`));
  }

  async function appliquer() {
    if (!choisi) return;
    setEnvoi(true);
    try {
      const plan = modeleEnPlan(choisi, t);
      const r = await api(`/restaurants/${restoId}/floor-plan/apply`, {
        method: 'POST', token,
        body: { rooms: [{ roomId: salleCible || undefined, name: nom.trim() || t(`floorPlan.tplRoom_${choisi.kind}`), replace: !!salleCible && remplacer, ...plan }] }
      });
      onApplique(r);
      toast(t('floorPlan.tplApplied'));
      onFermer();
    } catch (e) { toast(e.message); } finally { setEnvoi(false); }
  }

  return (
    <div className="card fp-assistant" role="dialog" aria-label={t('floorPlan.tplTitle')}>
      <div className="fp-assistant-tete">
        <b>🧩 {cible ? t('floorPlan.tplTitleRoom', { name: cible.name }) : t('floorPlan.tplTitle')}</b>
        <button type="button" className="btn-ghost" style={{ padding: '2px 8px' }} onClick={onFermer} aria-label={t('floorPlan.close')}>✕</button>
      </div>
      {!choisi ? (
        <>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('floorPlan.tplIntro')}</p>
          <div className="fp-modeles">
            {MODELES.map((m) => {
              const plan = modeleEnPlan(m, t);
              return (
                <button type="button" key={m.id} className="fp-modele" onClick={() => choisir(m)}>
                  <PlanApercu {...plan} t={t} />
                  <b>{m.icone} {t(`floorPlan.tpl_${m.id}`)}</b>
                  <span className="small">{t('floorPlan.tplMeta', { seats: couvertsDe(m), tables: m.tables.length, w: m.widthM, d: m.depthM })}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="fp-modele-detail">
            <PlanApercu {...modeleEnPlan(choisi, t)} t={t} />
            <p className="small" style={{ margin: '6px 0 10px' }}>
              <b>{choisi.icone} {t(`floorPlan.tpl_${choisi.id}`)}</b> — {t(`floorPlan.tpl_${choisi.id}_desc`)}
            </p>
          </div>
          <div className="fp-champs">
            <div className="fp-large">
              <label htmlFor="fp-modele-nom">{t('floorPlan.aiRoomName')}</label>
              <input id="fp-modele-nom" value={nom} maxLength={40} onChange={(e) => setNom(e.target.value)} />
            </div>
            {!cible && salles.length > 0 && (
              <div className="fp-large">
                <label htmlFor="fp-modele-cible">{t('floorPlan.aiTarget')}</label>
                <select id="fp-modele-cible" value={salleCible} onChange={(e) => { setSalleCible(e.target.value); setRemplacer(!!e.target.value); }}>
                  <option value="">{t('floorPlan.aiNewRoom')}</option>
                  {salles.map((s) => <option key={s.id} value={s.id}>{AREA_ICONS[s.kind]} {s.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {salleCible && (
            <label className="fp-case" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={remplacer} onChange={(e) => setRemplacer(e.target.checked)} />
              <span>{nbTablesCible > 0 ? t('floorPlan.aiReplace', { n: nbTablesCible }) : t('floorPlan.tplReplaceEmpty')}</span>
            </label>
          )}
          <div className="fp-actions" style={{ marginTop: 10 }}>
            <button type="button" className="btn-teal" disabled={envoi} onClick={appliquer}>{envoi ? '…' : `✅ ${t('floorPlan.tplUse')}`}</button>
            <button type="button" className="btn-ghost" disabled={envoi} onClick={() => setChoisi(null)}>{t('floorPlan.tplBack')}</button>
          </div>
          <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('floorPlan.aiAfterHint')}</p>
        </>
      )}
    </div>
  );
}
