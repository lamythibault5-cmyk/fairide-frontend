import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { ouvrirPdf, telechargerPdf } from '../pdf';
import { useAuth } from '../context/AuthContext';
import { useLanguage, getLocale } from '../context/LanguageContext';

// « Mon contrat et mes conditions » dans Mon compte (livreur) : le statut choisi et le contrat signé (ou à
// signer), les conditions qui s'appliquent à ce statut avec les chiffres légaux de l'année et où en est le
// la façon dont il est payé (frais de livraison à 100 %, pourboires, versement chaque lundi), et un comparatif
// des deux statuts (étudiant-indépendant, indépendant — l'économie collaborative est retirée, CODE-12). Tout vient de /couriers/me : aucun montant ni taux n'est écrit ici,
// et une valeur absente de la configuration s'affiche « — ».
const pct = (x) => (x == null || x === '' ? '—' : `${(Number(x) * 100).toFixed(2).replace(/\.?0+$/, '')} %`);
const euro = (n) => (n == null || n === '' ? '—' : `${Math.round(Number(n)).toLocaleString(getLocale())} €`);
// Montants légaux au centime près (cotisations, dispenses) : arrondir à l'euro les rendrait faux.
const euroCentimes = (n) => (n == null || n === '' ? '—' : `${Number(n).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);


const EMOJI = { student_independent: '🎓 ', independent: '🧾 ' };

export default function DriverContractTerms() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState(null);
  useEffect(() => { api('/couriers/me', { token }).then(setD).catch((e) => setErreur(e.message)); }, [token]);

  if (erreur) return <p className="small">{erreur}</p>;
  if (!d) return <p className="small">{t('accountUi.loading')}</p>;
  const c = d.courier; const L = d.legal ?? {}; const statut = c.statusType;
  const P = d.pricing ?? {};
  const eur2 = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`;
  // Contrat signé dans sa version courante ; une version plus ancienne reste consultable mais doit être re-signée.
  const versionCourante = d.contractVersions?.[statut];
  const ancien = statut ? (d.contracts ?? []).find((k) => k.contractType === statut) : null;
  const signe = ancien && (!versionCourante || ancien.version === versionCourante) ? ancien : null;

  const conditions = {
    student_independent: [
      t('driverTerms.si1'),
      t('driverTerms.si2', { exoEtu: euroCentimes(L.studentIndependentExemption), taux: pct(L.independentSocialRate), plafondEtu: euroCentimes(L.studentIndependentCeiling) }),
      t('driverTerms.si3', { plafond: euro(L.franchiseMaxTurnover) }),
      t('driverTerms.si4'),
      t('driverTerms.si5', { plafond: euro(L.studentParentsCeiling) })
    ],
    independent: [
      t('driverTerms.ind1'),
      t('driverTerms.ind2', { plafond: euro(L.franchiseMaxTurnover) }),
      t('driverTerms.ind3'),
      t('driverTerms.ind4'),
      t('driverTerms.ind5', { taux: pct(L.independentSocialRate), exoCompl: euroCentimes(L.independentComplementaryExemption), minTrim: euroCentimes(L.independentMinQuarterly), starter: euroCentimes(L.independentStarterQuarterly) }),
      t('driverTerms.ind7')
    ]
  };
  const retenue = statut === 'student_independent' ? t('driverTerms.payWithholdingStudentIndependent')
    : statut === 'independent' ? t('driverTerms.payWithholdingIndependent') : null;

  return (
    <div className="driver-terms">
      {/* Statut et contrat */}
      <h4 className="paiement-titre">{t('driverTerms.statusTitle')}</h4>
      {statut ? (
        <>
          <p style={{ margin: '0 0 4px' }}><b>{EMOJI[statut] || ''}{t(`courierOnboarding.status_${statut}`)}</b></p>
          <p className="small" style={{ margin: '0 0 10px' }}>{t(`courierOnboarding.status_${statut}_desc`)}</p>
          {ancien && !signe && (
            <p className="small" style={{ margin: '0 0 8px' }}>🆕 {t('driverTerms.newVersion', { version: versionCourante, old: ancien.version })}</p>
          )}
          {signe ? (
            <div className="paiement-encart">
              <b>✅ {t('driverTerms.contractSigned', { date: new Date(signe.signedAt).toLocaleDateString(getLocale()), version: signe.version })}</b>
              <p className="small" style={{ margin: '4px 0 0' }}>{t(`courierOnboarding.contract_${statut}`)}</p>
              <p className="small" style={{ margin: '6px 0 0', overflowWrap: 'anywhere' }}>
                {t('courierOnboarding.contractHash')} <code>{signe.documentHash.slice(0, 16)}…</code> · {t('driverTerms.signedBy', { name: signe.typedName })}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}/couriers/me/contract/${signe.id}/pdf`, token, t('courierOnboarding.previewFailed'))}>📄 {t('driverTerms.openContract')}</button>
                <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => telechargerPdf(`${API_BASE}/couriers/me/contract/${signe.id}/pdf`, token, `contrat-fairide-${signe.contractType}-${signe.version}.pdf`, t('courierOnboarding.previewFailed'))}>⬇️ {t('driverTerms.savePdf')}</button>
              </div>
              {/* Tous ses contrats signés (un par statut / version) : chacun s'ouvre et s'enregistre en PDF. */}
              {(d.contracts || []).filter((k) => k.id !== signe.id).length > 0 && (
                <div className="small" style={{ marginTop: 8 }}>
                  <b>{t('driverTerms.otherContracts')}</b>
                  {(d.contracts || []).filter((k) => k.id !== signe.id).map((k) => (
                    <div key={k.id} className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                      <span>{EMOJI[k.contractType] || ''}{k.version} · {k.signedAt ? new Date(k.signedAt).toLocaleDateString(getLocale()) : ''}</span>
                      <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => ouvrirPdf(`${API_BASE}/couriers/me/contract/${k.id}/pdf`, token, t('courierOnboarding.previewFailed'))}>📄</button>
                      <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => telechargerPdf(`${API_BASE}/couriers/me/contract/${k.id}/pdf`, token, `contrat-fairide-${k.contractType}-${k.version}.pdf`, t('courierOnboarding.previewFailed'))}>⬇️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="paiement-encart">
              <b>✍️ {t('driverTerms.contractToSign')}</b>
              <p className="small" style={{ margin: '4px 0 0' }}>{t(`courierOnboarding.contract_${statut}`)}</p>
              <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}/couriers/me/contract/preview`, token, t('courierOnboarding.previewFailed'))}>📄 {t('courierOnboarding.contractPreview')}</button>
                <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => telechargerPdf(`${API_BASE}/couriers/me/contract/preview`, token, 'contrat-fairide.pdf', t('courierOnboarding.previewFailed'))}>⬇️ {t('driverTerms.savePdf')}</button>
                <Link className="btn-gold" style={{ padding: '6px 12px', fontSize: 13, textDecoration: 'none' }} to="/driver/onboarding">{t('driverTerms.goSign')}</Link>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="paiement-encart">
          <b>{t('driverTerms.noStatus')}</b>
          <p className="small" style={{ margin: '4px 0 8px' }}>{t('driverTerms.noStatusHelp')}</p>
          <Link className="btn-gold" style={{ padding: '6px 12px', fontSize: 13, textDecoration: 'none' }} to="/driver/onboarding">{t('driverTerms.goOnboarding')}</Link>
        </div>
      )}

      {/* Conditions du statut + situation */}
      {statut && conditions[statut] && (
        <>
          <h4 className="paiement-titre">{t('driverTerms.conditionsTitle', { year: L.year || new Date().getFullYear() })}</h4>
          <ul className="paiement-etapes" style={{ listStyle: 'disc' }}>
            {conditions[statut].map((ligne, i) => <li key={i}>{ligne}</li>)}
          </ul>
        </>
      )}

      {/* Paiement */}
      <h4 className="paiement-titre">{t('driverTerms.payTitle')}</h4>
      <ol className="paiement-etapes">
        <li>{t('driverTerms.pay1')}</li>
        <li>{t('driverTerms.pay2')}</li>
        <li>{t('driverTerms.payRates', { base: eur2(P.deliveryBaseFee), km: Number(P.deliveryBaseKm || 0), motor: eur2(P.driverPerKmMotor), bike: eur2(P.driverPerKmBike), diff: eur2((P.driverPerKmMotor || 0) - (P.driverPerKmBike || 0)) })}</li>
        <li><b>{t('driverTerms.pay3')}</b></li>
        {retenue && <li>{retenue}</li>}
        <li>{t('driverTerms.pay4')}</li>
        <li>{t('driverTerms.pay5', { km: P.bikeMaxKm || 4 })}</li>
      </ol>

      {/* Comparatif des deux statuts : plafond, retenue, cotisations, TVA, démarches */}
      <h4 className="paiement-titre">{t('driverTerms.compareTitle')}</h4>
      <div className="service-table-wrap">
        <table className="service-table paiement-table driver-terms-table">
          <thead>
            <tr><th></th><th>🎓 {t('courierOnboarding.status_student_independent')}</th><th>🧾 {t('courierOnboarding.status_independent')}</th></tr>
          </thead>
          <tbody>
            <tr><td>{t('driverTerms.rowWho')}</td><td>{t('driverTerms.whoStudentIndependent')}</td><td>{t('driverTerms.whoIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowLimit')}</td><td>{t('driverTerms.limitStudentIndependent', { plafond: euro(L.studentIndependentCeiling) })}</td><td>{t('driverTerms.limitIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowDeduction')}</td><td>{t('driverTerms.deductionStudentIndependent')}</td><td>{t('driverTerms.deductionIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowSocial')}</td><td>{t('driverTerms.socialStudentIndependent', { exemption: euro(L.studentIndependentExemption) })}</td><td>{t('driverTerms.socialIndependent', { taux: pct(L.independentSocialRate) })}</td></tr>
            <tr><td>{t('driverTerms.rowVat')}</td><td>{t('driverTerms.vatStudentIndependent', { max: euro(L.franchiseMaxTurnover) })}</td><td>{t('driverTerms.vatIndependent', { max: euro(L.franchiseMaxTurnover) })}</td></tr>
            <tr><td>{t('driverTerms.rowSteps')}</td><td>{t('driverTerms.stepsStudentIndependent')}</td><td>{t('driverTerms.stepsIndependent')}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="small" style={{ margin: '8px 0 0' }}>{t('driverTerms.changeStatus')} <Link to="/driver/onboarding">{t('driverTerms.goOnboarding')}</Link></p>
    </div>
  );
}
