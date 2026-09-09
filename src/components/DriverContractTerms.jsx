import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage, getLocale } from '../context/LanguageContext';

// « Mon contrat et mes conditions » dans Mon compte (livreur) : le statut choisi et le contrat signé (ou à
// signer), les conditions qui s'appliquent à ce statut avec les chiffres légaux de l'année et où en est le
// livreur (heures / revenus), la façon dont il est payé (frais de livraison à 100 %, pourboires, versement
// chaque lundi, retenues selon le statut), et un comparatif des trois statuts. Tout vient de /couriers/me.
const pct = (x) => `${(Number(x || 0) * 100).toFixed(2).replace(/\.?0+$/, '')} %`;
const euro = (n) => `${Math.round(Number(n || 0)).toLocaleString(getLocale())} €`;

async function ouvrirPdf(url, token, messageErreur) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(messageErreur);
    const blob = await res.blob(); window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  } catch (e) { alert(e.message); }
}

export default function DriverContractTerms() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState(null);
  useEffect(() => { api('/couriers/me', { token }).then(setD).catch((e) => setErreur(e.message)); }, [token]);

  if (erreur) return <p className="small">{erreur}</p>;
  if (!d) return <p className="small">{t('accountUi.loading')}</p>;
  const c = d.courier; const L = d.legal || {}; const statut = c.statusType;
  const P = d.pricing || {};
  const eur2 = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`;
  // Contrat signé dans sa version courante ; une version plus ancienne reste consultable mais doit être re-signée.
  const versionCourante = d.contractVersions?.[statut];
  const ancien = statut ? d.contracts.find((k) => k.contractType === statut) : null;
  const signe = ancien && (!versionCourante || ancien.version === versionCourante) ? ancien : null;
  const sit = d.situation;

  const conditions = {
    student: [
      t('driverTerms.stu1', { h: L.studentMaxHours, taux: pct(L.studentSolidarityRate), tauxEmp: pct(L.studentSolidarityEmployerRate) }),
      t('driverTerms.stu2', { taux: pct(L.studentOrdinaryRate) }),
      t('driverTerms.stu3', { age: L.studentMinAge }),
      t('driverTerms.stu4'),
      t('driverTerms.stu5', { plafond: euro(L.studentParentsCeiling) })
    ],
    p2p: [
      t('driverTerms.p2p1', { plafond: euro(L.p2pMaxGross), annee: L.year }),
      t('driverTerms.p2p2', { taux: pct(L.p2pWithholdingRate) }),
      t('driverTerms.p2p3'),
      t('driverTerms.p2p4')
    ],
    independent: [
      t('driverTerms.ind1'),
      t('driverTerms.ind2', { plafond: euro(L.franchiseMaxTurnover) }),
      t('driverTerms.ind3'),
      t('driverTerms.ind4')
    ]
  };
  const retenue = statut === 'p2p' ? t('driverTerms.payWithholdingP2p', { taux: pct(L.p2pWithholdingRate) })
    : statut === 'student' ? t('driverTerms.payWithholdingStudent', { taux: pct(L.studentSolidarityRate) })
    : statut === 'independent' ? t('driverTerms.payWithholdingIndependent') : null;

  return (
    <div className="driver-terms">
      {/* Statut et contrat */}
      <h4 className="paiement-titre">{t('driverTerms.statusTitle')}</h4>
      {statut ? (
        <>
          <p style={{ margin: '0 0 4px' }}><b>{statut === 'student' ? '🎓 ' : statut === 'p2p' ? '🤝 ' : '🧾 '}{t(`courierOnboarding.status_${statut}`)}</b></p>
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
              <button type="button" className="btn-outline" style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}/couriers/me/contract/${signe.id}/pdf`, token, t('courierOnboarding.previewFailed'))}>📄 {t('driverTerms.openContract')}</button>
            </div>
          ) : (
            <div className="paiement-encart">
              <b>✍️ {t('driverTerms.contractToSign')}</b>
              <p className="small" style={{ margin: '4px 0 0' }}>{t(`courierOnboarding.contract_${statut}`)}</p>
              <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}/couriers/me/contract/preview`, token, t('courierOnboarding.previewFailed'))}>📄 {t('courierOnboarding.contractPreview')}</button>
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
      {statut && (
        <>
          <h4 className="paiement-titre">{t('driverTerms.conditionsTitle', { year: L.year || new Date().getFullYear() })}</h4>
          <ul className="paiement-etapes" style={{ listStyle: 'disc' }}>
            {conditions[statut].map((ligne, i) => <li key={i}>{ligne}</li>)}
          </ul>
          {sit && sit.type !== 'none' && (
            <div className="paiement-encart" style={{ marginBottom: 10 }}>
              <b>{sit.type === 'hours' ? t('driverTerms.usageHours', { used: sit.used, max: sit.max }) : t('driverTerms.usageIncome', { used: Number(sit.used).toFixed(0), max: Number(sit.max).toFixed(0) })}</b>
              <div className="courier-bar" style={{ marginTop: 6 }}><div style={{ width: `${Math.min(100, Math.round((sit.pct || 0) * 100))}%` }} /></div>
              <p className="small" style={{ margin: '4px 0 0' }}>{sit.bloque ? t('driverTerms.usageBlocked') : t('driverTerms.usageHelp')}</p>
            </div>
          )}
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

      {/* Comparatif des trois statuts */}
      <h4 className="paiement-titre">{t('driverTerms.compareTitle')}</h4>
      <div className="service-table-wrap">
        <table className="service-table paiement-table driver-terms-table">
          <thead>
            <tr><th></th><th>🎓 {t('courierOnboarding.status_student')}</th><th>🤝 {t('courierOnboarding.status_p2p')}</th><th>🧾 {t('courierOnboarding.status_independent')}</th></tr>
          </thead>
          <tbody>
            <tr><td>{t('driverTerms.rowWho')}</td><td>{t('driverTerms.whoStudent')}</td><td>{t('driverTerms.whoP2p')}</td><td>{t('driverTerms.whoIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowLimit')}</td><td>{t('driverTerms.limitStudent', { h: L.studentMaxHours })}</td><td>{t('driverTerms.limitP2p', { plafond: euro(L.p2pMaxGross) })}</td><td>{t('driverTerms.limitIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowDeduction')}</td><td>{t('driverTerms.deductionStudent', { taux: pct(L.studentSolidarityRate) })}</td><td>{t('driverTerms.deductionP2p', { taux: pct(L.p2pWithholdingRate) })}</td><td>{t('driverTerms.deductionIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowDocs')}</td><td>{t('driverTerms.docsStudent')}</td><td>{t('driverTerms.docsP2p')}</td><td>{t('driverTerms.docsIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowTax')}</td><td>{t('driverTerms.taxStudent')}</td><td>{t('driverTerms.taxP2p')}</td><td>{t('driverTerms.taxIndependent')}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="small" style={{ margin: '8px 0 0' }}>{t('driverTerms.changeStatus')} <Link to="/driver/onboarding">{t('driverTerms.goOnboarding')}</Link></p>
    </div>
  );
}
