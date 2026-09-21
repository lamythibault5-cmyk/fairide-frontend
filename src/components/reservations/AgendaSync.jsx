import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import urlSure from '../../urlSure';

// SYNCHRONISER AVEC SON AGENDA — les réservations Fairide dans l'agenda que le restaurateur regarde déjà
// (Google Agenda, Apple Calendrier sur iPhone et Mac, Outlook), par un lien d'abonnement iCal privé.
// Lecture seule : l'agenda externe se relit tout seul, à son propre rythme ; on gère toujours dans Fairide.
// Côté serveur : calendarFeed.js (contenu), routes/calendar.js (flux), /restaurants/:id/calendar-feed (lien).

export default function AgendaSync({ restoId, token, toast }) {
  const { t } = useLanguage();
  const [flux, setFlux] = useState(null); // { enabled, details, url, webcal, google, outlook, outlook365 }
  const [occupe, setOccupe] = useState(false);
  const [copie, setCopie] = useState(false);
  const [confirmer, setConfirmer] = useState(''); // '' | 'regenerer' | 'desactiver'

  useEffect(() => {
    api(`/restaurants/${restoId}/calendar-feed`, { token }).then(setFlux).catch(() => setFlux({ enabled: false, details: false }));
  }, [restoId, token]);

  async function appeler(chemin, options) {
    setOccupe(true);
    try { setFlux(await api(`/restaurants/${restoId}/calendar-feed${chemin}`, { token, ...options })); setConfirmer(''); return true; } catch (e) { toast(e.message); return false; } finally { setOccupe(false); }
  }
  async function copier() {
    try { await navigator.clipboard.writeText(flux.url); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch { toast(t('resa.copyFailed')); }
  }

  if (!flux) return null;

  return (
    <div className="card agenda-sync" id="agenda-externe">
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>📅 {t('resa.calTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('resa.calHelp')}</p>

      {!flux.enabled ? (
        <button type="button" className="btn-teal" disabled={occupe} onClick={() => appeler('?create=1', {})}>{occupe ? '…' : t('resa.calEnable')}</button>
      ) : (
        <>
          <div className="agenda-sync-boutons">
            <a className="agenda-sync-btn" href={urlSure(flux.google)} target="_blank" rel="noopener noreferrer">
              <b>Google Agenda</b><span>{t('resa.calGoogleSub')}</span>
            </a>
            <a className="agenda-sync-btn" href={urlSure(flux.webcal)}>
              <b>{t('resa.calApple')}</b><span>{t('resa.calAppleSub')}</span>
            </a>
            <a className="agenda-sync-btn" href={urlSure(flux.outlook)} target="_blank" rel="noopener noreferrer">
              <b>Outlook.com</b><span>{t('resa.calOutlookSub')}</span>
            </a>
            <a className="agenda-sync-btn" href={urlSure(flux.outlook365)} target="_blank" rel="noopener noreferrer">
              <b>Microsoft 365</b><span>{t('resa.calOutlook365Sub')}</span>
            </a>
          </div>

          <label className="small" htmlFor="agenda-lien" style={{ display: 'block', margin: '12px 0 4px', fontWeight: 700 }}>{t('resa.calOther')}</label>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input id="agenda-lien" readOnly value={flux.url} onFocus={(e) => e.target.select()} style={{ flex: '1 1 260px', minWidth: 0 }} />
            <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={copier}>{copie ? t('resa.copied') : t('resa.copy')}</button>
          </div>
          <p className="small" style={{ margin: '6px 0 0', opacity: 0.8 }}>{t('resa.calDelay')}</p>

          <label className="agenda-sync-details">
            <input type="checkbox" checked={!!flux.details} disabled={occupe} onChange={(e) => appeler('', { method: 'PATCH', body: { details: e.target.checked } })} />
            <span>
              <b>{t('resa.calDetails')}</b><br />
              <span className="small">{flux.details ? t('resa.calDetailsOn') : t('resa.calDetailsOff')}</span>
            </span>
          </label>

          <p className="small" style={{ margin: '10px 0 0' }}>🔒 {t('resa.calPrivate')}</p>
          {confirmer ? (
            <div className="agenda-sync-confirmer">
              <p className="small" style={{ margin: '0 0 8px' }}>{t(confirmer === 'regenerer' ? 'resa.calRegenerateConfirm' : 'resa.calDisableConfirm')}</p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-outline" disabled={occupe}
                  onClick={() => (confirmer === 'regenerer' ? appeler('/regenerate', { method: 'POST', body: {} }) : appeler('', { method: 'DELETE' }))}>
                  {occupe ? '…' : t(confirmer === 'regenerer' ? 'resa.calRegenerateYes' : 'resa.calDisableYes')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmer('')}>{t('resa.calCancel')}</button>
              </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setConfirmer('regenerer')}>{t('resa.calRegenerate')}</button>
              <button type="button" className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setConfirmer('desactiver')}>{t('resa.calDisable')}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
