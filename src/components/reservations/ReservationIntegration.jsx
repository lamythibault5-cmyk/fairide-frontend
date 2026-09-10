import { useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { qrSvgPath } from './qr';

// INTÉGRATION — le lien de réservation public du restaurant, prêt à coller partout : fiche Google,
// Instagram, Facebook, site web (bouton ou iframe), QR code à imprimer. Aucune donnée serveur : tout
// se déduit de l'identifiant du restaurant.

const ORIGINE_PUBLIQUE = 'https://fairide.be';

export default function ReservationIntegration({ restoId, restaurant, toast }) {
  const { t } = useLanguage();
  const origine = typeof window !== 'undefined' && /^https?:\/\/(www\.)?fairide\.be$/.test(window.location.origin) ? window.location.origin : ORIGINE_PUBLIQUE;
  const lien = `${origine}/reserver/${restoId}`;
  const [copie, setCopie] = useState('');
  const qr = useMemo(() => qrSvgPath(lien), [lien]);

  async function copier(cle, texte) {
    try { await navigator.clipboard.writeText(texte); setCopie(cle); setTimeout(() => setCopie(''), 2000); } catch { toast(t('resa.copyFailed')); }
  }
  const bouton = `<a href="${lien}" target="_blank" rel="noopener" style="display:inline-block;background:#3B2FB5;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;font-family:sans-serif">${t('resa.embedButtonLabel')}</a>`;
  const iframe = `<iframe src="${lien}?embed=1" title="${t('resa.embedIframeTitle', { name: restaurant?.name || '' })}" style="width:100%;max-width:520px;height:720px;border:0;border-radius:16px" loading="lazy"></iframe>`;
  const svgTexte = qr ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${qr.viewBox}" width="512" height="512"><rect width="100%" height="100%" fill="#fff"/><path d="${qr.d}" fill="#14121F"/></svg>` : '';

  function telechargerQr() {
    if (!svgTexte) return;
    const blob = new Blob([svgTexte], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `qr-reservation-${(restaurant?.name || 'fairide').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const Copier = ({ cle, texte }) => (
    <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => copier(cle, texte)}>{copie === cle ? t('resa.copied') : t('resa.copy')}</button>
  );

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.intLinkTitle')}</h3>
        <p className="small" style={{ margin: '0 0 8px' }}>{t('resa.intLinkHelp')}</p>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input readOnly value={lien} onFocus={(e) => e.target.select()} style={{ flex: '1 1 260px', minWidth: 0 }} aria-label={t('resa.intLinkTitle')} />
          <Copier cle="lien" texte={lien} />
          <a className="btn-ghost" href={lien} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', fontSize: 12 }}>{t('resa.intOpen')}</a>
        </div>
        {!restaurant?.offersDineIn && <p className="small" style={{ color: 'var(--red)', margin: '8px 0 0' }}>{t('resa.intDineInOff')}</p>}
        {restaurant && !restaurant.publicListed && !restaurant.isDemo && <p className="small" style={{ margin: '8px 0 0' }}>{t('resa.intNotListed')}</p>}
      </div>

      <div className="resa-integration-grille">
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.intQrTitle')}</h3>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('resa.intQrHelp')}</p>
          <div className="resa-qr">
            {qr ? <svg viewBox={qr.viewBox} role="img" aria-label={t('resa.intQrAria')} shapeRendering="crispEdges"><path d={qr.d} /></svg> : <p className="small">{t('resa.intQrError')}</p>}
            <div className="row" style={{ gap: 6, flexDirection: 'column', alignItems: 'flex-start' }}>
              <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={telechargerQr} disabled={!qr}>{t('resa.intQrDownload')}</button>
              <span className="small">{t('resa.intQrPrintHint')}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.intButtonTitle')}</h3>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('resa.intButtonHelp')}</p>
          <p style={{ margin: '0 0 10px' }}><a className="resa-bouton-demo" href={lien} target="_blank" rel="noopener noreferrer">{t('resa.embedButtonLabel')}</a></p>
          <pre className="resa-snippet">{bouton}</pre>
          <div className="resa-snippet-actions"><Copier cle="bouton" texte={bouton} /></div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.intIframeTitle')}</h3>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('resa.intIframeHelp')}</p>
          <pre className="resa-snippet">{iframe}</pre>
          <div className="resa-snippet-actions"><Copier cle="iframe" texte={iframe} /></div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.intGuidesTitle')}</h3>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('resa.intGuidesHelp')}</p>
          {['google', 'instagram', 'facebook', 'site'].map((g) => (
            <details key={g} className="resa-etapes" style={{ paddingLeft: 0, marginBottom: 6 }}>
              <summary>{t(`resa.intGuide_${g}_title`)}</summary>
              <ol className="resa-etapes" style={{ marginTop: 6 }}>
                {[1, 2, 3, 4].map((i) => <li key={i}>{t(`resa.intGuide_${g}_${i}`)}</li>)}
              </ol>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
