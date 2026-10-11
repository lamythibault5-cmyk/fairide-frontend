import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { estNatif } from '../natif';
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
 * Ce qu'on promet est ce que le serveur envoie vraiment (pushService.js, vérifié le 2026-10-11) : au client, le
 * livreur à la porte ; au commerce, chaque nouvelle commande. Le livreur ne reçoit aujourd'hui aucune notification :
 * l'écran ne lui est pas montré (Bienvenue.jsx écrit 'non' pour lui). */
export default function AmorceNotifications() {
  const { user, token, role } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [ouvert, setOuvert] = useState(() => lireBienvenue().amorceNotifs === 'a-faire');
  const [attente, setAttente] = useState(false);

  if (!ouvert || !user || !estNatif() || user.isAdmin || !['client', 'restaurant'].includes(role)) return null;

  const fermer = () => { ecrireBienvenue({ amorceNotifs: 'fait' }); setOuvert(false); };
  async function activer() {
    setAttente(true);
    const issue = await abonner(token).catch(() => 'erreur');
    setAttente(false);
    if (issue === 'refuse') toast(t('appli.notifRefusee'));
    else if (issue === 'indisponible' || issue === 'erreur') toast(t('appli.notifIndispo'));
    fermer();
  }

  const commerce = role === 'restaurant';
  return (
    <div className="bv bv-par-dessus" role="dialog" aria-modal="true" aria-label={commerce ? t('appli.coNotifTitre') : t('appli.notifTitre')}>
      <main className="bv-ecran">
        <EcranPermission
          icone="cloche"
          titre={commerce ? t('appli.coNotifTitre') : t('appli.notifTitre')}
          sous={commerce ? t('appli.coNotifSub') : t('appli.notifSub')}
          faits={commerce ? [] : [['porte', t('appli.n1'), t('appli.n1S')]]}
          bouton={t('appli.notifBtn')} attente={attente} onOui={activer} onNon={fermer}
        />
      </main>
    </div>
  );
}
