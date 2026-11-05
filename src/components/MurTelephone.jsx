import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { experienceApp } from '../natif';
import EcranPlein from './EcranPlein';
import VerifTelephone from './VerifTelephone';
import { Langues } from '../pages/app/EcransBienvenue';

/* COMMERCES ET LIVREURS PROUVENT LEUR NUMÉRO DÈS L'INSCRIPTION (fondateur, 2026-11-05).
 *
 * Depuis le 02/11 (maquettes/inscription-legere) aucun compte ne demandait de code : le client prouve son numéro à sa première
 * commande, et ça reste ainsi. Pour un commerce, l'étape « Vérifie ton mobile » restait facultative, et le 05/11 en production
 * 22 commerces approuvés sur 30 n'avaient pas de numéro prouvé : le SMS de rappel d'une commande en attente (orderTimeouts.js)
 * ne partait chez aucun d'eux. Le fondateur : commerces et livreurs vérifient à l'inscription, seul le client peut attendre.
 *
 * Un seul mur, ici, devant tout l'espace commerce (/dashboard) et livreur (/driver) : ProtectedRoute le pose pour ces deux
 * rôles. Il couvre l'inscription par e-mail, Google ou Apple, sur le site comme dans l'app, celui qui ferme l'app avant d'avoir
 * tapé le code (il retombe ici), et les comptes déjà ouverts sans numéro prouvé (fondateur : « à la prochaine ouverture »).
 * Pas de « Plus tard ». Deux issues pour ne jamais enfermer personne :
 *   - « Je n'ai pas reçu le SMS », puis le code par e-mail (repliEmail, fondateur : un SMS perdu ne bloque pas une inscription,
 *     le 22/10 il a coûté deux commerces) : on entre, mais le numéro reste à prouver (backend phone_email_fallback_at). L'étape
 *     « Vérifie ton mobile » reste donc dans la liste du commerce, et l'écran « Ton numéro » bloque toujours l'envoi du dossier
 *     livreur (backend routes/couriers.js, manque 'telephone') ;
 *   - « Se déconnecter ».
 * Pas de mur pour l'équipe qui agit pour un compte (le serveur refuse le code, refuserAgirPour), ni pour un compte de test
 * (boutique.test@, livreur.test@ : les relecteurs des stores s'y connectent, sans le téléphone derrière), ni en simulation.
 * Les anciennes versions de l'app ne le montrent pas : elles l'auront à la prochaine mise à jour.
 * Qui le voit : murTelephone() dans ProtectedRoute.jsx (chargé d'emblée ; cet écran ne se télécharge que pour qui le voit). */
export default function MurTelephone({ role }) {
  const { logout, refreshUser } = useAuth();
  const { t } = useLanguage();
  const titre = t('verifTel.murTitre');
  const sous = role === 'driver' ? t('verifTel.dossierSous') : t('verifTel.murSousCommerce');
  // Prouvé (ou code reçu par e-mail) : VerifTelephone a déjà relu le compte ; le mur tombe avec lui.
  const contenu = <VerifTelephone auto repliEmail onFait={() => refreshUser?.()} />;
  if (experienceApp()) {
    return (
      <EcranPlein etiquette={titre}>
        <main className="bv-ecran">
          <div className="bv-haut"><div className="bv-grandit" /><Langues /></div>
          <div className="bv-form">
            <h1 className="bv-titre bv-titre-form">{titre}</h1>
            <p className="bv-sous">{sous}</p>
            {contenu}
            <div className="bv-grandit" />
            <button type="button" className="bv-lien" onClick={() => logout()}>{t('nav.logout')}</button>
          </div>
        </main>
      </EcranPlein>
    );
  }
  return (
    <div className="wrap mur-tel">
      <div className="card">
        <h1>{titre}</h1>
        <p className="mur-tel-sous">{sous}</p>
        {contenu}
        <button type="button" className="lien-bouton mur-tel-quitter" onClick={() => logout()}>{t('nav.logout')}</button>
      </div>
    </div>
  );
}
