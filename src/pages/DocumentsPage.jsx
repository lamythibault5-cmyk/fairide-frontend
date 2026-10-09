import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { ouvrirPdf, telechargerPdf } from '../pdf';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { SkeletonCards } from '../components/Skeleton';

// « Mes documents » (fondateur, 2026-10-09) : tout ce que la personne a accepté ou signé, facile à retrouver, à lire et à
// enregistrer — conditions générales et politique de confidentialité (client, commerce, livreur), contrat de partenariat du
// commerce (version courante avec sa signature, et chaque version acceptée), contrats de livreur (chaque version signée).
// Les données viennent de GET /me/documents ; rien n'est calculé ici.
export default function DocumentsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const fmt = (x) => (x ? new Date(x).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const charger = () => api('/me/documents', { token }).then(setD).catch((e) => toast(e.message, 'erreur'));
  useEffect(() => { charger(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accepterCgu() {
    setBusy(true);
    try { await api('/auth/terms/accept', { method: 'POST', token, body: { accepted: true, version: d.terms.version, context: 'reaccept' } }); toast(t('mesDocuments.termsAccepted')); await charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  const Signature = ({ url }) => (url ? <img src={url} alt={t('signature.aria')} style={{ display: 'block', maxWidth: 200, maxHeight: 80, marginTop: 6, background: '#fff', border: '1px solid var(--line, #e1d9c4)', borderRadius: 8 }} /> : null);
  const Boutons = ({ pdfPath, nom }) => (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}${pdfPath}`, token, t('mesDocuments.pdfFailed'))}>📄 {t('mesDocuments.open')}</button>
      <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => telechargerPdf(`${API_BASE}${pdfPath}`, token, nom, t('mesDocuments.pdfFailed'))}>⬇️ {t('mesDocuments.save')}</button>
    </div>
  );

  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      <h1 style={{ margin: '0 0 4px' }}>{t('mesDocuments.title')}</h1>
      <p className="small" style={{ margin: '0 0 16px', opacity: 0.8 }}>{t('mesDocuments.intro')}</p>
      {!d ? <SkeletonCards count={2} /> : (
        <>
          {/* Conditions générales */}
          <div className="card" style={{ marginBottom: 12 }}>
            <b>📜 {t('mesDocuments.termsTitle')}</b>
            <p className="small" style={{ margin: '4px 0 0' }}>{t('mesDocuments.version', { version: d.terms.version, date: fmt(d.terms.effectiveAt) })}</p>
            <p className="small" style={{ margin: '4px 0 0' }}>
              {d.terms.accepted
                ? `✅ ${t('mesDocuments.termsAcceptedOn', { date: fmt(d.terms.lastAccepted?.at), version: d.terms.lastAccepted?.version || d.terms.version })}`
                : d.terms.lastAccepted ? `🆕 ${t('mesDocuments.termsOutdated', { version: d.terms.lastAccepted.version })}` : `✍️ ${t('mesDocuments.termsNotAccepted')}`}
            </p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <Link to={d.terms.path} className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }}>📖 {t('mesDocuments.read')}</Link>
              {!d.terms.accepted && <button type="button" className="btn-gold" style={{ padding: '6px 12px', fontSize: 13 }} disabled={busy} onClick={accepterCgu}>{t('mesDocuments.acceptTerms')}</button>}
            </div>
          </div>
          {/* Confidentialité */}
          <div className="card" style={{ marginBottom: 12 }}>
            <b>🔒 {t('mesDocuments.privacyTitle')}</b>
            <p className="small" style={{ margin: '4px 0 0' }}>{t('mesDocuments.version', { version: d.privacy.version, date: fmt(d.privacy.effectiveAt) })}</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <Link to={d.privacy.path} className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }}>📖 {t('mesDocuments.read')}</Link>
            </div>
          </div>
          {/* Contrat(s) de commerce */}
          {d.restaurants.map((c) => (
            <div className="card" key={c.restaurantId} style={{ marginBottom: 12 }}>
              <b>🤝 {t('mesDocuments.restoContractTitle', { name: c.name })}</b>
              <p className="small" style={{ margin: '4px 0 0' }}>{c.title} · {t('mesDocuments.contractVersion', { version: c.currentVersion })}</p>
              {c.accepted ? (
                <>
                  <p className="small" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>✅ {t('mesDocuments.signedOn', { date: fmt(c.acceptedAt), name: c.acceptedName })}{c.hash ? ` · ${t('mesDocuments.hash')} ${c.hash.slice(0, 16)}…` : ''}</p>
                  <Signature url={c.signatureUrl} />
                  <Boutons pdfPath={c.pdfPath} nom={`contrat-fairide-${c.currentVersion}.pdf`} />
                </>
              ) : (
                <>
                  <p className="small" style={{ margin: '4px 0 0' }}>{c.acceptedAt ? `🆕 ${t('mesDocuments.restoOutdated', { version: c.acceptedVersion })}` : `✍️ ${t('mesDocuments.restoNotAccepted')}`}</p>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <Link to={c.acceptPath} className="btn-gold" style={{ padding: '6px 12px', fontSize: 13 }}>✍️ {t('mesDocuments.readAndSign')}</Link>
                    <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}${c.pdfPath}`, token, t('mesDocuments.pdfFailed'))}>📄 {t('mesDocuments.open')}</button>
                  </div>
                </>
              )}
              {c.history.filter((h) => !(c.accepted && h.version === c.acceptedVersion)).length > 0 && (
                <div className="small" style={{ marginTop: 10 }}>
                  <b>{t('mesDocuments.previousVersions')}</b>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {c.history.filter((h) => !(c.accepted && h.version === c.acceptedVersion)).map((h) => (
                      <li key={h.id}>{h.version} · {t('mesDocuments.signedOn', { date: fmt(h.acceptedAt), name: h.typedName })}{h.pdfUrl ? <> · <a href={h.pdfUrl} target="_blank" rel="noreferrer">{t('mesDocuments.open')}</a></> : null}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {/* Contrats de livreur */}
          {d.courier && (
            <div className="card" style={{ marginBottom: 12 }}>
              <b>🚴 {t('mesDocuments.courierTitle')}</b>
              {d.courier.title && <p className="small" style={{ margin: '4px 0 0' }}>{d.courier.title} · {d.courier.currentVersion}</p>}
              {!d.courier.signed && (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <p className="small" style={{ margin: 0, flex: '1 1 100%' }}>✍️ {t('mesDocuments.courierNotSigned')}</p>
                  <Link to={d.courier.signPath} className="btn-gold" style={{ padding: '6px 12px', fontSize: 13 }}>✍️ {t('mesDocuments.readAndSign')}</Link>
                  <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}${d.courier.previewPath}`, token, t('mesDocuments.pdfFailed'))}>📄 {t('mesDocuments.open')}</button>
                </div>
              )}
              {d.courier.contracts.map((k) => (
                <div key={k.id} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line, #e1d9c4)' }}>
                  <p className="small" style={{ margin: 0, overflowWrap: 'anywhere' }}>✅ {k.title} · {k.version} · {t('mesDocuments.signedOn', { date: fmt(k.signedAt), name: k.typedName })}{k.hash ? ` · ${t('mesDocuments.hash')} ${k.hash.slice(0, 16)}…` : ''}</p>
                  <Signature url={k.signatureUrl} />
                  <Boutons pdfPath={k.pdfPath} nom={`contrat-fairide-${k.contractType}-${k.version}.pdf`} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
