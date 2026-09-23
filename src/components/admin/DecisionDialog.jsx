import { useEffect, useId, useState } from 'react';
import Modale from '../Modale';
import { useLanguage } from '../../context/LanguageContext';

/* Suspendre ou résilier un compte = une décision motivée (backlog de conformité D6, B7).
 *
 * Le serveur refuse désormais tout passage à « bloqué » sans faits, base contractuelle et exposé des
 * motifs — et la base elle-même le refuse (déclencheur, migration 005). Ce dialogue recueille ce qu'il
 * faut : la mesure, les faits (qui partent tels quels dans l'exposé envoyé à la personne), la clause du
 * contrat ou des CGU, la base légale le cas échéant. Pour la résiliation d'un commerce : 30 jours de
 * préavis (P2B art. 4), ou une exception nommée.
 *
 * onConfirm(payload) reçoit { measure, facts, contractualBasis, legalBasis, effectiveAt?, noticeException? }. */
export default function DecisionDialog({ open, cible, targetType, loading, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const id = useId();
  const [measure, setMeasure] = useState('suspension');
  const [facts, setFacts] = useState('');
  const [contractualBasis, setContractualBasis] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [exception, setException] = useState('');
  const dans30 = new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10);
  const [effectiveAt, setEffectiveAt] = useState(dans30);
  useEffect(() => { if (open) { setMeasure('suspension'); setFacts(''); setContractualBasis(''); setLegalBasis(''); setException(''); setEffectiveAt(dans30); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const resiliationCommerce = targetType === 'restaurant' && measure === 'termination';
  const pret = facts.trim().length >= 20 && contractualBasis.trim().length > 0;
  function valider() {
    onConfirm({
      measure, facts: facts.trim(), contractualBasis: contractualBasis.trim(), legalBasis: legalBasis.trim() || undefined,
      ...(resiliationCommerce ? (exception ? { noticeException: exception } : { effectiveAt: new Date(`${effectiveAt}T00:00:00`).toISOString() }) : {})
    });
  }
  return (
    <Modale titre={t('conformite.decisionTitle', { name: cible || '' })} largeur={560} onFermer={onCancel}>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('conformite.decisionIntro')}</p>
      <div className="field">
        <label htmlFor={`${id}-m`}>{t('conformite.decisionMeasure')}</label>
        <select id={`${id}-m`} value={measure} onChange={(e) => setMeasure(e.target.value)}>
          <option value="suspension">{t('conformite.measure_suspension')}</option>
          <option value="termination">{t('conformite.measure_termination')}</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-f`}>{t('conformite.decisionFacts')}</label>
        <textarea id={`${id}-f`} rows={4} value={facts} onChange={(e) => setFacts(e.target.value)} placeholder={t('conformite.decisionFactsPh')} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-c`}>{t('conformite.decisionContract')}</label>
        <input id={`${id}-c`} value={contractualBasis} onChange={(e) => setContractualBasis(e.target.value)} placeholder={t('conformite.decisionContractPh')} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-l`}>{t('conformite.decisionLegal')}</label>
        <input id={`${id}-l`} value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} />
      </div>
      {resiliationCommerce && (
        <div className="field">
          <label htmlFor={`${id}-e`}>{t('conformite.decisionNotice')}</label>
          <select id={`${id}-e`} value={exception} onChange={(e) => setException(e.target.value)}>
            <option value="">{t('conformite.decisionNotice30')}</option>
            {['legal_obligation', 'repeated_infringement', 'imminent_danger'].map((x) => <option key={x} value={x}>{t(`conformite.exception_${x}`)}</option>)}
          </select>
          {!exception && <input type="date" aria-label={t('conformite.decisionEffective')} min={dans30} value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} style={{ marginTop: 6 }} />}
        </div>
      )}
      <p className="small" style={{ color: 'var(--ink-soft)' }}>{t('conformite.decisionStatementNote')}</p>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={loading}>{t('common.cancel')}</button>
        <button type="button" className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={loading || !pret} onClick={valider}>
          {loading ? '…' : t('conformite.decisionConfirm')}
        </button>
      </div>
    </Modale>
  );
}
