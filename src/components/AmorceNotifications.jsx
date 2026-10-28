import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { experienceApp } from '../natif';
import { abonner } from '../push';
import { ecrireBienvenue, lireBienvenue } from '../bienvenue';
import BrandMark from './BrandMark';

/* « Activer les notifications », UNE fois, juste après la création du compte dans l'application.
 *
 * Le dernier écran de l'accueil (pages/app/Bienvenue.jsx), déplacé après l'inscription parce que le jeton de
 * l'appareil s'enregistre SUR UN COMPTE (POST /push/native-token) : avant, il n'y a rien à quoi l'attacher.
 * L'accueil laisse `amorceNotifs: 'a-faire'` dans la mémoire du téléphone (bienvenue.js) ; on le passe à 'fait'
 * quelle que soit la réponse — on ne redemande pas, les réglages du téléphone restent la voie pour changer d'avis.
 *
 * Ce qu'on promet est ce que le serveur envoie vraiment (backend pushFile.js et notifLivreurs.js, 2026-10-11) : au client,
 * chaque étape de sa commande et le livreur à la porte ; au commerce, nouvelle commande, commande en attente, annulée,
 * livreur qui attend ; au livreur, les courses qu'il verrait, sa course prête ou annulée. Chacun retrouve ce réglage
 * ensuite : Mes commandes (client), Courses disponibles (livreur), barre d'alerte des commandes (commerce).
 *
 * LA NOTIFICATION EN GRAND (fondateur, 2026-10-28, version B de maquettes/notifs-badge/notifs-badge.html). Avant : un écran blanc,
 * la cloche en haut à gauche, qui ne ressemblait pas à l'écran du badge juste après (EcranBadge.jsx, iris et centré). Il prend la
 * même forme : tout en iris, au milieu une notification dessinée comme sur l'écran verrouillé, avec le même halo lime, un titre,
 * « Continuer ». Le texte de la notification est celui que le serveur envoie vraiment (backend pushFile.js : client_livraison,
 * livreur_prete, resto_en_attente), avec « ta pizzeria » pour exemple. Livreur et commerce ont le même dessin et leurs textes.
 * Toujours « Continuer », jamais « Pas maintenant » : Apple refuse parfois un écran qui propose de repousser la question avant
 * de la poser (règle 5.1.1) ; refuser se fait dans la fenêtre du système. Le Retour d'Android ferme encore. */
export default function AmorceNotifications() {
  const { user, token, role } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [ouvert, setOuvert] = useState(() => lireBienvenue().amorceNotifs === 'a-faire');
  const [attente, setAttente] = useState(false);

  if (!ouvert || !user || !experienceApp() || user.isAdmin || !['client', 'restaurant', 'driver'].includes(role)) return null;

  const fermer = () => { ecrireBienvenue({ amorceNotifs: 'fait' }); setOuvert(false); };
  async function activer() {
    setAttente(true);
    const issue = await abonner(token).catch(() => 'erreur');
    setAttente(false);
    if (issue === 'refuse') toast(t('appli.notifRefusee'));
    else if (issue === 'indisponible' || issue === 'erreur') toast(t('appli.notifIndispo'));
    fermer();
  }

  // Préfixes des textes de chaque profil : l'exemple de notification (titre, corps) et le titre de l'écran.
  const p = { restaurant: 'coNotif', driver: 'lvNotif', client: 'notif' }[role];
  const titre = t(`appli.${p}Ecran`);
  return (
    // Le Retour d'Android (natif.js) envoie Échap au dialogue du dessus : ici, c'est « Plus tard » (audit du 19/10, CROSS-05).
    <div className="bv bv-iris bv-par-dessus" role="dialog" aria-modal="true" aria-label={titre} onKeyDown={(e) => { if (e.key === 'Escape' && !attente) fermer(); }}>
      <main className="bv-ecran bv-notifs">
        <div className="bv-grandit" />
        <div className="bv-centre">
          {/* Dessin seulement : le titre dit la même chose aux lecteurs d'écran. */}
          <div className="bv-notif-exemple" aria-hidden="true">
            <span className="bv-notif-icone"><BrandMark size={30} tile={false} color="#C8F03C" animer={false} /></span>
            <span className="bv-notif-texte">
              <span className="bv-notif-haut"><span>FAIRRIDE</span><span>{t('appli.notifMaintenant')}</span></span>
              <b>{t(`appli.${p}ExTitre`)}</b>
              <span>{t(`appli.${p}ExCorps`)}</span>
            </span>
          </div>
          <h1 className="bv-titre bv-notifs-titre">{titre}</h1>
        </div>
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" disabled={attente} onClick={activer}>{attente ? t('common.loading') : t('appli.continuer')}</button>
      </main>
    </div>
  );
}
