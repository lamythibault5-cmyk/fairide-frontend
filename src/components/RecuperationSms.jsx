import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PhoneInput from './PhoneInput';

/* RETROUVER SON COMPTE PAR SMS (fondateur, 2026-11-06, G52 / G147). L'adresse e-mail n'est pas prouvée à l'inscription : une
 * faute de frappe, ou un compte Apple « Masquer mon e-mail » ouvert sur iPhone puis cherché depuis Android, et « Mot de passe
 * oublié » écrivait dans une boîte que la personne n'a pas ; se réinscrire avec son numéro répondait PHONE_TAKEN. Le numéro,
 * lui, a été prouvé par SMS : un code y part (backend routes/auth.js, /forgot-password/phone), et le code donne le lien de
 * réinitialisation, ouvert ici, avec l'adresse du compte (ResetPassword.jsx la montre).
 * Sous « Mot de passe oublié », sur le site (Auth.jsx) et dans l'application (ConnexionAppli.jsx). Pas de <form> : l'écran
 * de l'application est déjà un formulaire ; Entrée valide l'étape en cours sans envoyer celui-là. */
export default function RecuperationSms({ classeBouton = 'btn-ghost', classeLien = 'btn-ghost' }) {
  const { recupererParSms, confirmerRecuperationSms } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [phone, setPhone] = useState('');
  const [masque, setMasque] = useState(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [attente, setAttente] = useState(false);

  if (!ouvert) {
    return <button type="button" className={classeLien} style={{ marginTop: 10 }} onClick={() => setOuvert(true)}>{t('auth.smsRecupLien')}</button>;
  }

  async function envoyer() {
    if (attente) return;
    if (!phone.trim()) { setErreur(t('auth.errFieldRequired')); return; }
    setAttente(true); setErreur('');
    try {
      const r = await recupererParSms(phone);
      setMasque(r?.phoneMasked || phone); setCode('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setAttente(false);
    }
  }

  async function valider() {
    if (attente || code.length !== 6) return;
    setAttente(true); setErreur('');
    try {
      const r = await confirmerRecuperationSms(phone, code);
      navigate(`/reset-password?token=${encodeURIComponent(r.resetToken)}`, { state: { email: r.email } });
    } catch (err) {
      setErreur(err.message);
      setAttente(false);
    }
  }

  const entree = (action) => (e) => { if (e.key === 'Enter') { e.preventDefault(); action(); } };

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t('auth.smsRecupTitre')}</h3>
      {masque === null ? (
        <>
          <p className="small" style={{ marginBottom: 10 }}>{t('auth.smsRecupTexte')}</p>
          <div className="field" onKeyDown={entree(envoyer)}>
            <label htmlFor="recup-sms-tel">{t('auth.smsRecupNumero')}</label>
            <PhoneInput id="recup-sms-tel" value={phone} onChange={setPhone} autoComplete="tel" />
          </div>
          {erreur && <p className="field-error" role="alert">{erreur}</p>}
          <button type="button" className={classeBouton} disabled={attente} onClick={envoyer}>{attente ? t('common.loading') : t('auth.smsRecupEnvoyer')}</button>
        </>
      ) : (
        <>
          <p className="small" style={{ marginBottom: 10 }}>{t('auth.smsRecupCodeTexte', { phone: masque })}</p>
          <div className="field">
            <label htmlFor="recup-sms-code">{t('auth.verifyCodeLabel')}</label>
            <input id="recup-sms-code" value={code} onKeyDown={entree(valider)}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
              inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
              style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6 }} />
          </div>
          {erreur && <p className="field-error" role="alert">{erreur}</p>}
          <button type="button" className={classeBouton} disabled={attente || code.length !== 6} onClick={valider}>{attente ? t('common.loading') : t('auth.smsRecupValider')}</button>
          <button type="button" className={classeLien} style={{ marginTop: 4 }} onClick={() => { setMasque(null); setCode(''); setErreur(''); }}>{t('auth.smsRecupAutreNumero')}</button>
        </>
      )}
    </div>
  );
}
