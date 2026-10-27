import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { experienceApp } from '../natif';
import { abonner } from '../push';
import { ecrireBienvenue, lireBienvenue } from '../bienvenue';
import { EcranPermission } from '../pages/app/EcransBienvenue';

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
 * UNE LIGNE, UN BOUTON (fondateur, 2026-10-27, N1 de maquettes/badge-position/badge-position.html : « trop de texte, ce n'est
 * pas si difficile à comprendre ») : la cloche, un titre qui dit ce que chacun y gagne, une phrase, « Continuer », qui pose la
 * question du système. Plus de cartes ni de « Pas maintenant » : Apple refuse parfois un écran qui propose de repousser la
 * question avant de la poser (règle 5.1.1) ; refuser se fait dans la fenêtre du système. Le Retour d'Android ferme encore. */
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

  const textes = {
    restaurant: { titre: t('appli.coNotifTitre'), sous: t('appli.coNotifSub') },
    driver: { titre: t('appli.lvNotifTitre'), sous: t('appli.lvNotifSub') },
    client: { titre: t('appli.notifTitre'), sous: t('appli.notifSub') }
  }[role];
  return (
    // Le Retour d'Android (natif.js) envoie Échap au dialogue du dessus : ici, c'est « Plus tard » (audit du 19/10, CROSS-05).
    <div className="bv bv-par-dessus" role="dialog" aria-modal="true" aria-label={textes.titre} onKeyDown={(e) => { if (e.key === 'Escape' && !attente) fermer(); }}>
      <main className="bv-ecran">
        <EcranPermission
          icone="cloche"
          titre={textes.titre}
          sous={textes.sous}
          faits={[]}
          bouton={t('appli.continuer')} attente={attente} onOui={activer}
        />
      </main>
    </div>
  );
}
