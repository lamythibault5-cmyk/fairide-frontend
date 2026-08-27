// Mode d'emploi du restaurateur : comment recevoir et traiter les commandes Fairide. Contenu statique
// (pas de données chargées, pas de nouvelle table) qui ne décrit QUE des fonctionnalités réellement
// implémentées à ce jour, vérifiées dans le code avant rédaction (voir orderStatus.jsx, OrdersPage.jsx,
// DashboardLayout.jsx, routes/orders.js et email.js côté backend).
//
// TODO fonctionnalités absentes aujourd'hui, mentionnées ici pour ne pas les réinventer ni les décrire
// comme existantes dans le mode d'emploi. Ordre de priorité proposé :
//   1. Web Push + son à la réception d'une nouvelle commande (aucun service worker, aucun
//      Notification.requestPermission/PushManager, aucun son ne sont présents dans le code actuel —
//      seul un rafraîchissement de la liste toutes les 15s, voir DashboardLayout.jsx, tient lieu d'alerte)
//   2. Choix du temps de préparation à l'acceptation + motif obligatoire au refus (PATCH /orders/:id/accept
//      et /refuse ne lisent aujourd'hui aucun champ du corps de la requête, voir routes/orders.js)
//   3. Impression dédiée du bon de commande (bouton + éventuelle compatibilité imprimante thermique
//      Bluetooth ESC/POS) — window.print() n'existe aujourd'hui que sur les pages Factures, pas sur les
//      commandes
//   4. Envoi du bon de commande par WhatsApp (aucun fournisseur SMS/WhatsApp n'est intégré actuellement)
//   5. Délai d'acceptation automatique avec annulation si dépassé (choix produit à trancher : aujourd'hui
//      une commande reste "Nouvelle" indéfiniment tant qu'elle n'est pas traitée manuellement)
export default function GuidePage() {
  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Mode d'emploi</h2>
      <p className="small" style={{ margin: '0 0 16px' }}>
        Ce guide explique comment recevoir et traiter les commandes Fairide au quotidien. Aucun matériel n'est imposé : un appareil avec un navigateur internet suffit.
      </p>

      <section className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>1. Ce qu'il faut pour commencer</h3>
        <p className="small">Aucun matériel n'est imposé par Fairide. Un appareil avec un navigateur internet suffit : téléphone, tablette ou ordinateur.</p>
        <p className="small">Une connexion internet stable est nécessaire pour voir les commandes arriver et pour les traiter.</p>
        <p className="small" style={{ marginBottom: 0 }}>Il est recommandé de réserver un appareil au comptoir, dédié à la réception des commandes, pour ne jamais le perdre de vue pendant le service.</p>
      </section>

      <section className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>2. Installer Fairide sur l'appareil</h3>
        <p className="small">L'installation sur l'écran d'accueil permet d'ouvrir directement l'espace restaurateur en plein écran, sans passer par le navigateur à chaque fois.</p>
        <p className="small" style={{ marginBottom: 4 }}><b>Sur Android (Chrome) :</b> ouvrir le site Fairide, appuyer sur le menu (les trois points en haut à droite), puis choisir « Ajouter à l'écran d'accueil ».</p>
        <p className="small" style={{ marginBottom: 0 }}><b>Sur iPhone ou iPad (Safari) :</b> ouvrir le site Fairide, appuyer sur le bouton Partager (le carré avec une flèche vers le haut), puis choisir « Sur l'écran d'accueil ».</p>
      </section>

      <section className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>3. Suivre les commandes pendant le service</h3>
        <p className="small">Il n'existe pas encore de notification automatique (pas de son, pas d'alerte visible même écran verrouillé) : la liste des commandes se met à jour automatiquement toutes les 15 secondes tant que la page est ouverte.</p>
        <p className="small">Un e-mail récapitulatif est envoyé automatiquement à l'adresse du restaurant à chaque commande payée (voir la solution de repli plus bas) : consulter aussi la boîte mail pendant le service permet de ne rien manquer.</p>
        <p className="small" style={{ marginBottom: 0 }}>En attendant que les notifications soient disponibles, il est conseillé de garder la page des commandes ouverte, l'appareil allumé et déverrouillé, et de vérifier l'écran régulièrement pendant les heures de service.</p>
      </section>

      <section className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>4. Recevoir et accepter une commande</h3>
        <p className="small">Une nouvelle commande apparaît dans la liste avec le statut Nouvelle. La fiche affiche les articles commandés, les options choisies pour chacun (par exemple une sauce ou une taille) et le commentaire laissé par le client, s'il y en a un.</p>
        <p className="small">Il n'existe pas de champ spécifique pour une allergie : si un client a une allergie, elle est signalée dans son commentaire ou par téléphone.</p>
        <p className="small">Deux boutons sont disponibles : Accepter et Refuser.</p>
        <ul className="small" style={{ margin: '0 0 8px', paddingLeft: 18 }}>
          <li>Accepter fait passer la commande au statut En préparation. Il n'y a pas aujourd'hui de choix du temps de préparation à ce moment-là.</li>
          <li>Refuser annule la commande et rembourse automatiquement le client. Il n'y a pas aujourd'hui de motif à indiquer.</li>
        </ul>
      </section>

      <section className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>5. Suivre la commande jusqu'à la fin</h3>
        <p className="small">Les statuts se suivent dans cet ordre : Nouvelle, En préparation, Prête, et pour une commande à livrer, En livraison, puis Livrée (Récupérée pour une commande à emporter, Terminée pour une commande sur place).</p>
        <p className="small">Pour une commande à livrer, une fois acceptée, l'application indique si un livreur a déjà confirmé la prise en charge ou si elle est encore en attente d'un livreur.</p>
        <p className="small">Une fois le plat prêt, il faut cliquer sur le bouton Prête : la commande passe à ce statut et devient visible pour les livreurs disponibles.</p>
        <p className="small">Pour une commande à emporter ou sur place, un code donné par le client permet de confirmer la remise. Pour une commande à livrer, un code donné par le livreur permet de confirmer qu'il a bien récupéré la commande.</p>
        <p className="small" style={{ marginBottom: 0 }}>Il n'existe pas aujourd'hui de délai automatique après lequel une commande non traitée serait annulée : une commande reste au statut Nouvelle jusqu'à ce qu'elle soit acceptée ou refusée manuellement. Il est donc important de vérifier la liste régulièrement.</p>
      </section>

      <section className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>6. Imprimer un bon de commande (optionnel)</h3>
        <p className="small" style={{ marginBottom: 0 }}>Cette fonctionnalité n'est pas encore disponible : il n'existe pas de bouton dédié pour imprimer une commande, ni de compatibilité avec une imprimante thermique Bluetooth. En attendant, la solution ci-dessous (e-mail) permet de garder une trace de chaque commande et de l'imprimer si besoin, depuis la messagerie.</p>
      </section>

      <section className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>7. Solution de repli : le bon de commande par e-mail</h3>
        <p className="small">À chaque commande payée, un e-mail récapitulatif est envoyé automatiquement à l'adresse e-mail du restaurant. Il contient la liste des articles avec leur prix, le sous-total, l'adresse de livraison si applicable, la consigne de livraison choisie par le client, son commentaire éventuel et son numéro de téléphone.</p>
        <p className="small" style={{ marginBottom: 0 }}>Cet e-mail peut être ouvert et imprimé depuis n'importe quelle messagerie, sans avoir besoin d'ouvrir Fairide ni d'imprimante spécifique. L'envoi par WhatsApp n'est pas encore disponible.</p>
      </section>

      <section className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>8. Questions fréquentes</h3>
        <div className="divider" />
        <p className="small" style={{ marginBottom: 2 }}><b>Une commande a été manquée</b></p>
        <p className="small">Comme il n'existe pas encore de notification, une commande peut être manquée si la page n'était pas ouverte au bon moment. Vérifier régulièrement l'e-mail et la page des commandes pendant le service permet de limiter ce risque.</p>
        <div className="divider" />
        <p className="small" style={{ marginBottom: 2 }}><b>L'appareil était éteint ou la connexion coupée</b></p>
        <p className="small">L'e-mail de commande part automatiquement depuis les serveurs de Fairide, indépendamment de l'appareil : il reste consultable dès que l'appareil (ou un autre) est de nouveau connecté.</p>
        <div className="divider" />
        <p className="small" style={{ marginBottom: 2 }}><b>Le client veut modifier sa commande après l'avoir passée</b></p>
        <p className="small">Une fois la commande payée, elle ne peut plus être modifiée ni annulée par le client lui-même. Il doit alors contacter directement le restaurant (numéro affiché sur la fiche de commande) ou le support Fairide.</p>
        <div className="divider" />
        <p className="small" style={{ marginBottom: 2 }}><b>Où retrouver l'historique et les relevés</b></p>
        <p className="small" style={{ marginBottom: 0 }}>L'historique des commandes se trouve dans la section Commandes du tableau de bord. Les factures et relevés se trouvent dans la section Factures.</p>
      </section>

      <section className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>9. Aide</h3>
        <p className="small" style={{ marginBottom: 0 }}>
          Pour toute question, le support Fairide est joignable par e-mail à <a href="mailto:contact@fairide.be">contact@fairide.be</a> ou par téléphone au <a href="tel:+32474200713">+32 474 20 07 13</a>.
        </p>
      </section>
    </div>
  );
}
