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
 * ensuite : Mes commandes (client), Courses disponibles (livreur), barre d'alerte des commandes (commerce). */
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
    restaurant: { titre: t('appli.coNotifTitre'), sous: t('appli.coNotifSub'), faits: [['commandes', t('appli.coN1'), t('appli.coN1S')], ['velo', t('appli.coN2'), t('appli.coN2S')]] },
    driver: { titre: t('appli.lvNotifTitre'), sous: t('appli.lvNotifSub'), faits: [['euro', t('appli.lvN1'), t('appli.lvN1S')], ['personnes', t('appli.lvN2'), t('appli.lvN2S')], ['coche', t('appli.lvN3'), t('appli.lvN3S')]] },
    client: { titre: t('appli.notifTitre'), sous: t('appli.notifSub'), faits: [['coche', t('appli.nAccept'), t('appli.nAcceptS')], ['velo', t('appli.nRoute'), t('appli.nRouteS')], ['porte', t('appli.n1'), t('appli.n1S')]] }
  }[role];
  return (
    // Le Retour d'Android (natif.js) envoie Échap au dialogue du dessus : ici, c'est « Plus tard » (audit du 19/10, CROSS-05).
    <div className="bv bv-par-dessus" role="dialog" aria-modal="true" aria-label={textes.titre} onKeyDown={(e) => { if (e.key === 'Escape' && !attente) fermer(); }}>
      <main className="bv-ecran">
        <EcranPermission
          icone="cloche"
          titre={textes.titre}
          sous={textes.sous}
          faits={textes.faits}
          bouton={t('appli.notifBtn')} attente={attente} onOui={activer} onNon={fermer}
        />
      </main>
    </div>
  );
}
