import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from './ConfirmDialog';

/* « TON ANCIEN MOT DE PASSE NE MARCHE PLUS » (fondateur, 2026-11-06, G51). Se connecter avec Google ou Apple sur un compte dont
 * l'adresse n'avait jamais été confirmée efface son mot de passe et déconnecte ses autres appareils (protection contre
 * l'inscription d'avance avec l'adresse d'un autre, gardée telle quelle). Rien ne le disait : un commerce qui essayait Google
 * sur son ordinateur trouvait la tablette de la cuisine déconnectée, et le mot de passe de l'équipe n'existait plus. La
 * fenêtre le dit une fois, juste après la connexion, avec de quoi choisir un nouveau mot de passe : l'adresse est prouvée
 * maintenant, donc « Mot de passe oublié » envoie directement le lien. Montée une fois pour toute l'application (App.jsx). */
export default function AvisReprise() {
  const { user, avisReprise, fermerAvisReprise, forgotPassword } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [envoi, setEnvoi] = useState(false);
  if (!avisReprise || !user) return null;

  async function choisirMotDePasse() {
    setEnvoi(true);
    try {
      await forgotPassword(user.email);
      toast(t('auth.repriseLienEnvoye', { email: user.email }), 'succes');
      fermerAvisReprise();
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <ConfirmDialog open icone="cadenas" title={t('auth.repriseTitre')}
      message={t('auth.repriseTexte', { fournisseur: avisReprise.fournisseur })}
      detail={avisReprise.twoFactor ? t('auth.repriseDeuxFacteurs') : null}
      confirmLabel={t('auth.repriseBouton')} cancelLabel={t('auth.reprisePlusTard')} loading={envoi}
      onConfirm={choisirMotDePasse} onCancel={fermerAvisReprise} />
  );
}
