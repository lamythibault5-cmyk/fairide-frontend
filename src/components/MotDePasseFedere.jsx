import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

/* COMPTE CRÉÉ AVEC GOOGLE OU APPLE (audit du 19/10, auth-18). À l'inscription par Google ou Apple, le serveur pose un mot de
 * passe aléatoire que personne ne connaît : « Changer le mot de passe » demandait le mot de passe actuel, et répondait
 * « Mot de passe actuel incorrect » à chaque essai. Au-dessus du formulaire (Mon compte), une ligne le dit et envoie le lien
 * « Mot de passe oublié » à l'adresse du compte : même parcours, mêmes règles qu'à la connexion (routes/auth.js). Le
 * formulaire reste, pour qui a ajouté un mot de passe depuis : le serveur ne dit pas encore si le compte en a un.
 * Composant à part : Account.jsx ne doit plus grossir (CLAUDE.md). */
export default function MotDePasseFedere() {
  const { t } = useLanguage();
  const { user, forgotPassword } = useAuth();
  const toast = useToast();
  const [envoi, setEnvoi] = useState(false);
  if (!user?.hasGoogleAuth && !user?.hasAppleAuth) return null;

  async function envoyer() {
    setEnvoi(true);
    try {
      const r = await forgotPassword(user.email);
      // Adresse jamais confirmée : le serveur demande d'abord le code reçu à l'adresse (Auth.jsx, « Mot de passe oublié »).
      toast(r?.confirmationRequired ? t('auth.forgotConfirmText', { email: user.email }) : t('auth.forgotSubmittedText', { email: user.email }));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div style={{ margin: '0 0 12px' }}>
      <p className="small" style={{ margin: '0 0 6px' }}>{t('account.passwordFederated')}</p>
      <button type="button" className="btn-outline btn-sm" disabled={envoi} onClick={envoyer}>{envoi ? t('common.loading') : t('account.passwordFederatedSend')}</button>
    </div>
  );
}
