import { useCallback, useEffect, useId, useState } from 'react';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage, getLocale } from '../../../context/LanguageContext';

/* Admin › Conformité › Présomption de salariat (CODE-13, DEC-21 ; serveur : presomptionSalariat.js).
 *
 * Les 8 critères de l'art. 337/3 de la loi-programme (I) du 27/12/2006, texte de la loi, la position de Fairide sur chacun
 * et la date de sa dernière revue. Présomption si 3 des 8, ou 2 des critères 4° à 8°, sont remplis : le bandeau du haut le
 * calcule. Revoir un critère ajoute une ligne datée (on ne réécrit pas l'histoire) — à faire après tout changement qui
 * touche les livreurs (prix, offres, notes, suspensions, géolocalisation), et au moins chaque trimestre. */
export default function CriteresSalariatTab() {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [g, setG] = useState(null);
  const charger = useCallback(() => { api('/admin/compliance/platform-work-criteria', { token }).then(setG).catch((e) => toast(e.message, 'erreur')); }, [token, toast]);
  useEffect(() => { charger(); }, [charger]);
  if (!g) return <p className="small">…</p>;
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('criteresSalariat.title')}</h3>
      <p className="small" style={{ margin: '0 0 8px' }}>{g.regle}</p>
      <p role="status" style={{ margin: '0 0 12px', fontWeight: 700, color: g.presomption ? 'var(--red)' : 'var(--iris)' }}>
        {g.presomption ? t('criteresSalariat.presumed', { n: g.remplis.length }) : t('criteresSalariat.notPresumed', { n: g.remplis.length })}
      </p>
      {g.lignes.map((l) => <Critere key={l.critere} l={l} token={token} toast={toast} onSaved={setG} />)}
      <p className="small" style={{ margin: '12px 0 0', color: 'var(--ink-soft)' }}>{t('criteresSalariat.disclaimer')}</p>
    </div>
  );
}

function Critere({ l, token, toast, onSaved }) {
  const { t } = useLanguage();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [rempli, setRempli] = useState(l.rempli);
  const [explication, setExplication] = useState(l.explication);
  const [envoi, setEnvoi] = useState(false);
  async function enregistrer() {
    setEnvoi(true);
    try {
      onSaved(await api(`/admin/compliance/platform-work-criteria/${l.critere}`, { method: 'POST', token, body: { met: rempli, explanation: explication } }));
      toast(t('criteresSalariat.saved')); setOuvert(false);
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }
  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <b>{l.critere}°</b>
        <span className="pill" style={{ color: l.rempli ? 'var(--red)' : 'var(--iris)' }}>{l.rempli ? t('criteresSalariat.met') : t('criteresSalariat.notMet')}</span>
      </div>
      <p className="small" style={{ margin: '4px 0', fontStyle: 'italic' }}>« {l.loi} »</p>
      <p className="small" style={{ margin: '4px 0' }}>{l.explication}</p>
      <p className="small" style={{ margin: '4px 0', color: 'var(--ink-soft)' }}>
        {l.revuLe ? t('criteresSalariat.reviewed', { date: new Date(l.revuLe).toLocaleDateString(getLocale()), by: l.revuPar || '—' }) : t('criteresSalariat.neverReviewed')}
        {' · '}<button type="button" className="btn-ghost" style={{ padding: '0 6px' }} onClick={() => setOuvert((x) => !x)}>{t('criteresSalariat.review')}</button>
      </p>
      {ouvert && (
        <div>
          <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={rempli} onChange={(e) => setRempli(e.target.checked)} />
            <span className="small">{t('criteresSalariat.metLabel')}</span>
          </label>
          <div className="field">
            <label htmlFor={`${id}-exp`} className="small">{t('criteresSalariat.explanation')}</label>
            <textarea id={`${id}-exp`} rows={3} value={explication} onChange={(e) => setExplication(e.target.value)} />
          </div>
          <button type="button" className="btn-teal" disabled={envoi || explication.trim().length < 20} onClick={enregistrer}>{t('criteresSalariat.save')}</button>
        </div>
      )}
    </div>
  );
}
