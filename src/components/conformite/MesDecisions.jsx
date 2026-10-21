import { useEffect, useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';

/* « DÉCISIONS ME CONCERNANT » (audit du 19/10, admin-39). L'exposé des motifs envoyé à une personne suspendue ou résiliée
 * lui promet de pouvoir contester « en répondant à cet e-mail ou depuis votre espace » (DSA art. 20, directive 2024/2831
 * art. 11) — or aucun écran n'appelait GET /account-cases/mine ni POST /account-cases/:id/appeal. Ce bloc, dans Mon compte
 * (tous les rôles), montre chaque décision et son exposé, et « Contester cette décision » enregistre le recours sur le
 * dossier : réponse sous 14 jours, réexamen par un autre membre de l'équipe, qui est prévenu (tâche et e-mail).
 *
 * N'affiche RIEN quand la personne n'a aucune décision (le cas de presque tout le monde) : pas de rubrique vide. L'exposé
 * est montré tel qu'il a été envoyé (le français fait foi), sans le retoucher. */
export default function MesDecisions() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const id = useId();
  const [cas, setCas] = useState([]);
  const [ouvert, setOuvert] = useState(null); // id du dossier dont le formulaire de recours est ouvert
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const charger = () => api('/account-cases/mine', { token }).then((r) => setCas(Array.isArray(r) ? r : [])).catch(() => setCas([]));
  useEffect(() => { if (token) charger(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cas.length) return null;
  const date = (d) => (d ? new Date(d).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  async function contester(c) {
    setEnvoi(true);
    try {
      const r = await api(`/account-cases/${c.id}/appeal`, { method: 'POST', token, body: { text: texte.trim() } });
      toast(t('conformite.myDecisionAppealSent', { date: date(r.responseDueAt) }), 'succes');
      setOuvert(null); setTexte(''); charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }
  return (
    <div className="card account-groupe" aria-label={t('conformite.myDecisionsTitle')}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{t('conformite.myDecisionsTitle')}</h3>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('conformite.myDecisionsIntro')}</p>
      {cas.map((c) => (
        <div key={c.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
          <p style={{ margin: 0 }}><b>{t(`conformite.measure_${c.measure}`)}</b> <span className="small">· {t('conformite.myDecisionOn', { date: date(c.decidedAt) })}{c.reinstatedAt ? ` · ${t('conformite.myDecisionLifted', { date: date(c.reinstatedAt) })}` : ''}</span></p>
          <details className="small" style={{ margin: '6px 0' }}>
            <summary>{t('conformite.myDecisionStatement')}</summary>
            {(c.statement || []).map((p, i) => <p key={i} style={{ margin: '6px 0 0' }}>{p}</p>)}
          </details>
          {c.appealDecidedAt && <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.myDecisionAppealDone', { outcome: t(`conformite.outcome_${c.appealOutcome}`) })}{c.appealReason ? ` ${c.appealReason}` : ''}</p>}
          {c.appealReceivedAt && !c.appealDecidedAt && <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.myDecisionAppealPending', { date: date(c.appealReceivedAt), due: date(c.appealDueAt) })}</p>}
          {!c.appealDecidedAt && !c.reinstatedAt && ouvert !== c.id && (
            <button type="button" className="btn-outline" style={{ marginTop: 6 }} onClick={() => { setOuvert(c.id); setTexte(''); }}>
              {c.appealReceivedAt ? t('conformite.myDecisionAppealMore') : t('conformite.myDecisionAppeal')}
            </button>
          )}
          {ouvert === c.id && (
            <div style={{ marginTop: 6 }}>
              <div className="field">
                <label htmlFor={`${id}-${c.id}`}>{t('conformite.myDecisionAppealLabel')}</label>
                <textarea id={`${id}-${c.id}`} rows={4} maxLength={4000} value={texte} onChange={(e) => setTexte(e.target.value)} />
              </div>
              <p className="small" style={{ margin: '0 0 8px', color: 'var(--ink-soft)' }}>{t('conformite.myDecisionAppealHelp')}</p>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn-ghost" onClick={() => setOuvert(null)} disabled={envoi}>{t('common.cancel')}</button>
                <button type="button" className="btn-teal" disabled={envoi || texte.trim().length < 10} onClick={() => contester(c)}>{envoi ? '…' : t('conformite.myDecisionAppealSend')}</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
