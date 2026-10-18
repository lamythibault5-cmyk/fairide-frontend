import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Icone from './Icone';

/* « CONFIRMER MON E-MAIL » (fondateur, 2026-10-18).
 *
 * L'inscription prouve le TÉLÉPHONE par SMS ; l'adresse e-mail se confirme ensuite. C'est elle qui reçoit le lien si l'on
 * oublie son mot de passe, et les nouvelles. Un code à 6 chiffres part à l'adresse et se tape ICI, dans le compte — pas un
 * lien : un lien suffirait à qui tient la boîte. Serveur : routes/auth.js, /me/email/confirm.
 *
 * Deux endroits, une seule logique (useConfirmationEmail) :
 *   - Mon compte › Données de connexion, sous l'adresse (EmailConfirmation, même allure que la vérification du téléphone) ;
 *   - Mes commandes, en carte de rappel (RappelEmail) : le plus tôt possible après l'inscription, pour qu'une adresse mal
 *     tapée se remarque (le code n'arrive pas) et se corrige avant qu'un inconnu ne puisse s'en servir. */
function useConfirmationEmail({ toastEnvoi = true } = {}) {
  const { user, token, refreshUser } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [etape, setEtape] = useState('repos'); // repos | envoye
  const [code, setCode] = useState('');
  const [occupe, setOccupe] = useState(false);

  async function demander() {
    setOccupe(true);
    try {
      const r = await api('/auth/me/email/confirm/send', { method: 'POST', token });
      if (r.alreadyConfirmed) { await refreshUser(); return; }
      setEtape('envoye');
      // La carte de rappel le dit déjà dans son texte : pas de toast qui le répète.
      if (toastEnvoi) toast(t('accountUi.emailCodeSent', { email: user.email }));
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  async function confirmer() {
    if (!code.trim()) { toast(t('accountUi.toastCodeRequired'), 'erreur'); return; }
    setOccupe(true);
    try {
      await api('/auth/me/email/confirm', { method: 'POST', token, body: { code: code.trim() } });
      await refreshUser();
      toast(t('accountUi.emailConfirmedToast'), 'succes');
      setEtape('repos'); setCode('');
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  const saisir = (v) => setCode(String(v).replace(/\D/g, '').slice(0, 6));
  const annuler = () => { setEtape('repos'); setCode(''); };
  return { user, etape, code, saisir, occupe, demander, confirmer, annuler, aConfirmer: !!user?.email && user.emailConfirmed === false };
}

// Mon compte : sous l'adresse, comme la vérification du téléphone (PhoneVerification.jsx) juste en dessous.
export default function EmailConfirmation() {
  const { t } = useLanguage();
  const { user, etape, code, saisir, occupe, demander, confirmer, annuler, aConfirmer } = useConfirmationEmail();
  if (!aConfirmer) return null;

  return (
    <div className="phone-verif" style={{ marginTop: 6 }}>
      {etape === 'repos' ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small" style={{ flex: '1 1 200px' }}><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('accountUi.emailNotConfirmed')}</span>
          <button type="button" className="btn-outline btn-sm" disabled={occupe} onClick={demander}>
            {occupe ? '...' : t('accountUi.confirmEmail')}
          </button>
        </div>
      ) : (
        <div>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('accountUi.emailCodeSent', { email: user.email })}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, margin: 0, minWidth: 140 }}>
              <input value={code} onChange={(e) => saisir(e.target.value)} placeholder="123456" maxLength={6} inputMode="numeric" autoComplete="one-time-code" aria-label={t('accountUi.confirmEmail')} />
            </div>
            <button type="button" className="btn-teal" disabled={occupe} onClick={confirmer}>{occupe ? '...' : t('accountUi.confirm')}</button>
            <button type="button" className="btn-ghost" disabled={occupe} onClick={demander}>{t('accountUi.resend')}</button>
            <button type="button" className="btn-ghost" onClick={annuler}>{t('accountUi.phoneVerifyLater')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Mes commandes : la carte de rappel. Même famille que les encarts d'information de la fiche (fond iris très clair, pastille
 * iris à l'icône blanche). « Plus tard » la range pour cette visite seulement : rien n'est gardé sur l'appareil, elle
 * revient à la prochaine visite tant que l'adresse n'est pas confirmée. */
export function RappelEmail() {
  const { t } = useLanguage();
  const { user, etape, code, saisir, occupe, demander, confirmer, aConfirmer } = useConfirmationEmail({ toastEnvoi: false });
  const [range, setRange] = useState(false);
  if (!aConfirmer || range) return null;

  return (
    <section className="rappel-email" aria-labelledby="rappel-email-titre">
      <span className="rappel-email-icone" aria-hidden="true"><Icone nom="courrier" taille={18} /></span>
      <div className="rappel-email-corps">
        <h2 id="rappel-email-titre">{t('orders.emailReminderTitle')}</h2>
        <p>{etape === 'repos' ? t('orders.emailReminderText', { email: user.email }) : t('accountUi.emailCodeSent', { email: user.email })}</p>
        {etape === 'repos' ? (
          <div className="rappel-email-actions">
            <button type="button" className="btn-outline btn-sm" disabled={occupe} onClick={demander}>{occupe ? '...' : t('orders.emailReminderSend')}</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setRange(true)}>{t('accountUi.phoneVerifyLater')}</button>
          </div>
        ) : (
          <form className="rappel-email-actions" onSubmit={(e) => { e.preventDefault(); confirmer(); }}>
            <input className="rappel-email-code" value={code} onChange={(e) => saisir(e.target.value)} placeholder="123456" maxLength={6}
              inputMode="numeric" autoComplete="one-time-code" aria-label={t('accountUi.confirmEmail')} />
            <button type="submit" className="btn-outline btn-sm" disabled={occupe}>{occupe ? '...' : t('accountUi.confirm')}</button>
          </form>
        )}
        <div className="rappel-email-liens">
          {etape === 'envoye' && <><button type="button" className="rappel-email-lien" disabled={occupe} onClick={demander}>{t('auth.resendCode')}</button></>}
          <Link to="/account" className="rappel-email-lien">{t('orders.emailReminderWrong')}</Link>
        </div>
      </div>
    </section>
  );
}
