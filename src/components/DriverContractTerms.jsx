import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage, getLocale } from '../context/LanguageContext';
import CourierUsageBar, { niveauxAlerte, libelleNiveaux } from './CourierUsageBar';

// « Mon contrat et mes conditions » dans Mon compte (livreur) : le statut choisi et le contrat signé (ou à
// signer), les conditions qui s'appliquent à ce statut avec les chiffres légaux de l'année et où en est le
// livreur (plafond P2P), la façon dont il est payé (frais de livraison à 100 %, pourboires, versement
// chaque lundi, retenue selon le statut), et un comparatif des trois statuts (économie collaborative,
// étudiant-indépendant, indépendant). Tout vient de /couriers/me : aucun montant ni taux n'est écrit ici,
// et une valeur absente de la configuration s'affiche « — ».
const pct = (x) => (x == null || x === '' ? '—' : `${(Number(x) * 100).toFixed(2).replace(/\.?0+$/, '')} %`);
const euro = (n) => (n == null || n === '' ? '—' : `${Math.round(Number(n)).toLocaleString(getLocale())} €`);
// Montants légaux au centime près (cotisations, dispenses) : arrondir à l'euro les rendrait faux.
const euroCentimes = (n) => (n == null || n === '' ? '—' : `${Number(n).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

async function ouvrirPdf(url, token, messageErreur) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(messageErreur);
    const blob = await res.blob(); window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  } catch (e) { alert(e.message); }
}

const EMOJI = { p2p: '🤝 ', student_independent: '🎓 ', independent: '🧾 ' };

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
  const sit = d.situation;
  const et = getLocale().startsWith('fr') ? 'et' : getLocale().startsWith('nl') ? 'en' : 'and';
  const niveaux = libelleNiveaux(niveauxAlerte(L), et);

  const conditions = {
    p2p: [
      t('driverTerms.p2p1', { plafond: euro(L.p2pAnnualCeilingGross), annee: L.year ?? '' }),
      t('driverTerms.p2p2', { taux: pct(L.p2pWithholdingRate) }),
      t('driverTerms.p2p3'),
      t('driverTerms.p2p4'),
      t('driverTerms.p2p5', { forfait: pct(L.p2pForfaitRate) }),
      t('driverTerms.p2p6')
    ],
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
  const retenue = statut === 'p2p' ? t('driverTerms.payWithholdingP2p', { taux: pct(L.p2pWithholdingRate) })
    : statut === 'student_independent' ? t('driverTerms.payWithholdingStudentIndependent')
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
      {statut && conditions[statut] && (
        <>
          <h4 className="paiement-titre">{t('driverTerms.conditionsTitle', { year: L.year || new Date().getFullYear() })}</h4>
          <ul className="paiement-etapes" style={{ listStyle: 'disc' }}>
            {conditions[statut].map((ligne, i) => <li key={i}>{ligne}</li>)}
          </ul>
          {statut === 'p2p' && sit && sit.type === 'income' && (
            <div className="paiement-encart" style={{ marginBottom: 10 }}>
              <CourierUsageBar situation={sit} legal={L} t={t} year={L.year}>
                <p className="small" style={{ margin: '4px 0 0' }}>{sit.bloque ? t('driverTerms.usageBlocked') : t('driverTerms.usageHelp', { levels: niveaux })}</p>
              </CourierUsageBar>
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

      {/* Comparatif des trois statuts : plafond, retenue, cotisations, TVA, démarches */}
      <h4 className="paiement-titre">{t('driverTerms.compareTitle')}</h4>
      <div className="service-table-wrap">
        <table className="service-table paiement-table driver-terms-table">
          <thead>
            <tr><th></th><th>🤝 {t('courierOnboarding.status_p2p')}</th><th>🎓 {t('courierOnboarding.status_student_independent')}</th><th>🧾 {t('courierOnboarding.status_independent')}</th></tr>
          </thead>
          <tbody>
            <tr><td>{t('driverTerms.rowWho')}</td><td>{t('driverTerms.whoP2p')}</td><td>{t('driverTerms.whoStudentIndependent')}</td><td>{t('driverTerms.whoIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowLimit')}</td><td>{t('driverTerms.limitP2p', { plafond: euro(L.p2pAnnualCeilingGross) })}</td><td>{t('driverTerms.limitStudentIndependent', { plafond: euro(L.studentIndependentCeiling) })}</td><td>{t('driverTerms.limitIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowDeduction')}</td><td>{t('driverTerms.deductionP2p', { taux: pct(L.p2pWithholdingRate) })}</td><td>{t('driverTerms.deductionStudentIndependent')}</td><td>{t('driverTerms.deductionIndependent')}</td></tr>
            <tr><td>{t('driverTerms.rowSocial')}</td><td>{t('driverTerms.socialP2p')}</td><td>{t('driverTerms.socialStudentIndependent', { exemption: euro(L.studentIndependentExemption) })}</td><td>{t('driverTerms.socialIndependent', { taux: pct(L.independentSocialRate) })}</td></tr>
            <tr><td>{t('driverTerms.rowVat')}</td><td>{t('driverTerms.vatP2p')}</td><td>{t('driverTerms.vatStudentIndependent', { max: euro(L.franchiseMaxTurnover) })}</td><td>{t('driverTerms.vatIndependent', { max: euro(L.franchiseMaxTurnover) })}</td></tr>
            <tr><td>{t('driverTerms.rowSteps')}</td><td>{t('driverTerms.stepsP2p')}</td><td>{t('driverTerms.stepsStudentIndependent')}</td><td>{t('driverTerms.stepsIndependent')}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="small" style={{ margin: '8px 0 0' }}>{t('driverTerms.changeStatus')} <Link to="/driver/onboarding">{t('driverTerms.goOnboarding')}</Link></p>
    </div>
  );
}
