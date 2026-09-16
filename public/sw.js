/* Service worker Fairide.
 *
 * IL NE MET RIEN EN CACHE, ET C'EST VOLONTAIRE.
 *
 * Un service worker qui précharge les fichiers de l'application est la manière la plus courante de
 * servir pendant des semaines une version périmée à quelqu'un qui recharge pourtant sa page : le
 * cache répond avant le réseau, et l'utilisateur n'a aucun moyen de s'en sortir. Fairide est une
 * application de commande en direct — un commerçant doit voir la commande de maintenant, un client
 * le prix d'aujourd'hui. Une page un peu plus lente vaut mieux qu'une page fausse.
 *
 * Ce fichier existe donc pour deux raisons, et deux seulement :
 *   1. rendre l'application installable — Chrome exige un service worker doté d'un gestionnaire
 *      `fetch` avant de proposer « Ajouter à l'écran d'accueil » ;
 *   2. recevoir les notifications push, qui ne peuvent arriver que par ici, précisément parce que
 *      c'est le seul code de la page qui tourne encore quand l'onglet est fermé.
 *
 * Si un jour un vrai cache hors-ligne devient nécessaire, ce sera une décision à part entière, avec
 * une stratégie de péremption et un moyen de forcer la mise à jour — pas un ajout discret ici.
 */

// Prendre la main tout de suite plutôt qu'au prochain lancement : sans cela, un commerçant qui
// vient d'activer les notifications devrait fermer et rouvrir tous ses onglets avant d'en recevoir.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Passe-plat. Ne pas retirer : c'est sa présence, pas son contenu, qui rend l'application
// installable. Il n'intercepte rien et ne répond rien lui-même.
self.addEventListener('fetch', () => {});

// L'URL ouverte au clic, et le regroupement des notifications, dépendent du type reçu.
const PAR_DEFAUT = {
  title: 'Fairide',
  body: '',
  url: '/dashboard/orders',
  tag: 'fairide'
};

self.addEventListener('push', (event) => {
  // Une charge illisible ne doit pas faire disparaître la notification en silence : mieux vaut
  // afficher un message générique, que le destinataire peut suivre, que rien du tout.
  let charge = {};
  try {
    charge = event.data ? event.data.json() : {};
  } catch {
    charge = {};
  }
  const donnees = { ...PAR_DEFAUT, ...charge };
  event.waitUntil(
    self.registration.showNotification(donnees.title, {
      body: donnees.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: donnees.tag,
      renotify: true,
      // La commande doit réveiller : sans cela Android peut l'afficher sans bruit ni écran allumé,
      // c'est-à-dire exactement le problème que le push est censé résoudre.
      requireInteraction: donnees.tag === 'fairide-commande',
      data: { url: donnees.url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || PAR_DEFAUT.url;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      // Réutiliser un onglet Fairide déjà ouvert plutôt que d'en empiler un de plus : le commerçant
      // en a un en permanence pendant le service, et c'est celui-là qu'il veut voir passer au premier
      // plan, avec sa liste de commandes déjà chargée.
      for (const fenetre of fenetres) {
        if (fenetre.url.includes(self.location.origin) && 'focus' in fenetre) {
          fenetre.navigate ? fenetre.navigate(cible) : null;
          return fenetre.focus();
        }
      }
      return self.clients.openWindow(cible);
    })
  );
});
