import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';

// « Mes documents » dans Mon compte (livreur) : la pièce d'identité recto / verso déposée à l'inscription
// (voir IdentityDocsPicker.jsx), l'attestation étudiant, et les autres pièces du dossier coursier, avec leur
// état de vérification. Chaque face se remplace tant qu'elle n'est pas vérifiée. Le dossier complet
// (statut, contrat, paiements) reste sur /driver/onboarding.
const IDENTITE = ['identity_card', 'driving_licence'];
const estImage = (url) => /\.(jpe?g|png|webp|heic)(\?|$)/i.test(url || '') || /\/image\/upload\//.test(url || '');

export default function DriverDocuments() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [dossier, setDossier] = useState(null);
  const [busy, setBusy] = useState(false);
  const entrees = useRef({});

  useEffect(() => { api('/couriers/me', { token }).then(setDossier).catch((e) => toast(e.message)); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deposer(docType, side, e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true);
    try {
      const r = await apiUpload('/couriers/me/documents', { file: f, token, fieldName: 'file', fields: { docType, ...(side ? { side } : {}) } });
      setDossier(r); toast(t('driverDocs.uploaded'));
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  }
  async function supprimer(id) {
    setBusy(true);
    try { setDossier(await api(`/couriers/me/documents/${id}`, { method: 'DELETE', token })); } catch (err) { toast(err.message); } finally { setBusy(false); }
  }

  if (!dossier) return <p className="small">{t('accountUi.loading')}</p>;
  const docs = dossier.documents || [];
  const identite = docs.filter((d) => IDENTITE.includes(d.docType));
  const kind = identite[0]?.docType || 'identity_card';
  const face = (side) => identite.find((d) => d.docType === kind && d.side === side) || (side === 'recto' ? identite.find((d) => !d.side) : null);
  const etudiant = docs.filter((d) => d.docType === 'school_certificate');
  const autres = docs.filter((d) => !IDENTITE.includes(d.docType) && d.docType !== 'school_certificate');
  const etat = (d) => (d.verifiedAt ? { ic: '✅', txt: t('driverDocs.verified'), cls: 'pill teal' } : d.rejectedReason ? { ic: '❌', txt: d.rejectedReason, cls: 'pill' } : { ic: '⏳', txt: t('driverDocs.pending'), cls: 'pill' });
  const idv = dossier.courier?.identity;

  function Face({ side }) {
    const d = face(side);
    const cle = `${kind}-${side}`;
    return (
      <div className={`doc-slot${d ? ' rempli' : ''}`}>
        <div className="doc-slot-body" style={{ cursor: 'default' }}>
          {d ? (estImage(d.fileUrl) ? <a href={d.fileUrl} target="_blank" rel="noreferrer"><img className="doc-slot-img" src={d.fileUrl} alt="" /></a> : <a className="doc-slot-vide" href={d.fileUrl} target="_blank" rel="noreferrer" aria-label={t('courierOnboarding.docView')}>📄</a>) : <span className="doc-slot-vide" aria-hidden="true">📷</span>}
          <span className="doc-slot-texte">
            <b>{side === 'recto' ? t('authDocs.front') : t('authDocs.back')}</b>
            {d ? <span className={etat(d).cls} style={{ alignSelf: 'flex-start' }}>{etat(d).ic} {etat(d).txt}</span> : <span className="small">{t('driverDocs.missing')}</span>}
            {d && <span className="small">{new Date(d.createdAt).toLocaleDateString(getLocale())}</span>}
          </span>
        </div>
        <input ref={(el) => { entrees.current[cle] = el; }} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} onChange={(e) => deposer(kind, side, e)} />
        {(!d || !d.verifiedAt) && (
          <button type="button" className="btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} disabled={busy} onClick={() => entrees.current[cle]?.click()}>
            {d ? t('courierOnboarding.docReplace') : t('courierOnboarding.docUpload')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('driverDocs.intro')}</p>
      {idv && idv.status === 'verified' && <p className="small" style={{ margin: '0 0 10px' }}>✅ {t('driverDocs.identityVerified', { provider: idv.provider === 'stripe_identity' ? 'Stripe Identity' : idv.provider === 'itsme' ? 'itsme' : 'Fairide' })}</p>}
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <b>{t(`courierOnboarding.doc_${kind}`)}</b>
        {identite.length === 0 && (
          <span className="small">· {t('driverDocs.chooseKind')} {IDENTITE.map((k) => <button key={k} type="button" className="btn-ghost" style={{ padding: '0 6px', fontSize: 12 }} onClick={() => { entrees.current[`${k}-recto`]?.click(); }}>{t(`courierOnboarding.doc_${k}`)}</button>)}</span>
        )}
      </div>
      <div className="doc-slots">
        <Face side="recto" />
        <Face side="verso" />
      </div>
      {identite.length === 0 && IDENTITE.filter((k) => k !== kind).map((k) => (
        <input key={k} ref={(el) => { entrees.current[`${k}-recto`] = el; }} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => deposer(k, 'recto', e)} />
      ))}

      <div style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <b>🎓 {t('courierOnboarding.doc_school_certificate')}</b> <span className="small">· {t('authDocs.optional')}</span>
            <p className="small" style={{ margin: '2px 0 0' }}>{t('authDocs.studentHelp')}</p>
          </div>
          <input ref={(el) => { entrees.current.etudiant = el; }} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => deposer('school_certificate', null, e)} />
          <button type="button" className="btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} disabled={busy} onClick={() => entrees.current.etudiant?.click()}>{etudiant.length ? t('courierOnboarding.docReplace') : t('courierOnboarding.docUpload')}</button>
        </div>
        {etudiant.map((d) => (
          <div key={d.id} className="small" style={{ marginTop: 4 }}>
            {etat(d).ic} <a href={d.fileUrl} target="_blank" rel="noreferrer">{t('courierOnboarding.docView')}</a> · {new Date(d.createdAt).toLocaleDateString(getLocale())}
            {!d.verifiedAt && <button type="button" className="btn-ghost" style={{ padding: '0 6px', fontSize: 12 }} disabled={busy} onClick={() => supprimer(d.id)}>{t('courierOnboarding.docDelete')}</button>}
          </div>
        ))}
      </div>

      {autres.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <b>{t('driverDocs.others')}</b>
          {autres.map((d) => (
            <div key={d.id} className="small" style={{ marginTop: 4 }}>
              {etat(d).ic} <a href={d.fileUrl} target="_blank" rel="noreferrer">{t(`courierOnboarding.doc_${d.docType}`)}</a>{d.side ? ` (${d.side === 'recto' ? t('authDocs.front') : t('authDocs.back')})` : ''} · {new Date(d.createdAt).toLocaleDateString(getLocale())}
            </div>
          ))}
        </div>
      )}
      <p className="small" style={{ margin: '12px 0 0' }}><Link to="/driver/onboarding">{t('driverDocs.goOnboarding')}</Link></p>
    </div>
  );
}
