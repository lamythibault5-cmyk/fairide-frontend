import usePageMeta from '../hooks/usePageMeta';
import RetourCompte from '../components/RetourCompte';

// Notre histoire — sortie de la page Compte, où elle occupait une carte de cinquante lignes que
// personne n'avait demandé à lire. Elle s'intercalait entre les coordonnées de connexion et les
// raccourcis, obligeant à la faire défiler à chaque visite pour atteindre le reste.
//
// Elle a sa page parce qu'elle se lit d'un bout à l'autre ou pas du tout : c'est un texte, pas un
// réglage. Publique à dessein — c'est un argument, et un argument que seuls les inscrits peuvent
// lire ne convainc personne.
export default function OurStory() {
  usePageMeta({ title: 'Notre histoire — Fairide', path: '/notre-histoire' });
  return (
    <div>
      <RetourCompte />
      <h2 className="section-title" style={{ marginTop: 0 }}>🧭 Notre histoire</h2>
      <div className="card">
        <p className="small" style={{ margin: '0 0 14px', opacity: 0.75 }}>Pourquoi Fairide existe, et ce vers quoi la plateforme avance.</p>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Le constat</h4>
        <p className="small" style={{ margin: '0 0 14px' }}>
          Sur les grandes plateformes de livraison, les commerces locaux perdent souvent entre 22 et 32% du montant de chaque commande en commission,
          une part qui pèse lourd sur leurs marges et qui finit parfois par se répercuter sur les prix payés par les clients. Les livreurs, de leur côté,
          ne touchent pas toujours l'intégralité des frais de livraison réglés par le client. Fairide est né de ce constat simple : il devait être possible
          de connecter commerces, clients et livreurs sans qu'une plateforme capte une part disproportionnée de la valeur créée par chacun.
        </p>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Notre mission</h4>
        <p className="small" style={{ margin: '0 0 14px' }}>
          Donner aux commerces indépendants de Bruxelles (restaurants, supermarchés, commerces de quartier) un moyen de proposer la livraison et la vente en
          ligne sans commission excessive, et permettre aux livreurs d'être rémunérés justement pour leur travail. Fairide veut démontrer qu'un modèle de
          livraison plus équitable est possible, sans sacrifier la qualité de service pour les clients.
        </p>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Notre démarche</h4>
        <ul className="small" style={{ margin: '0 0 14px', paddingLeft: 18 }}>
          <li>Une commission plafonnée à 10% du montant des produits pour les commerces partenaires, contre 22 à 32% sur les grandes plateformes.</li>
          <li>Les livreurs touchent 100% des frais de livraison réglés pour leur course.</li>
          <li>Des frais annoncés clairement aux commerces comme aux clients, sans commission cachée.</li>
          <li>Aucun matériel n'est imposé aux commerces partenaires : un simple appareil avec un navigateur suffit pour recevoir et traiter les commandes.</li>
        </ul>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Notre identité</h4>
        <p className="small" style={{ margin: '0 0 14px' }}>
          Fairide est conçue et opérée depuis la Belgique, par des Belges, pour des Belges. La plateforme est aujourd'hui active dans 19 communes
          bruxelloises et met un point d'honneur à soutenir le commerce local et les indépendants qui font vivre le quartier, pour que la valeur créée
          profite d'abord à Bruxelles.
        </p>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Nos valeurs</h4>
        <ul className="small" style={{ margin: '0 0 14px', paddingLeft: 18 }}>
          <li><b>Équité</b> : envers les commerces, qui gardent une plus grande part de leurs revenus, et envers les livreurs, justement payés.</li>
          <li><b>Transparence</b> : des frais clairs et compréhensibles, communiqués sans surprise.</li>
          <li><b>Proximité</b> : un ancrage bruxellois, au service des commerces et des habitants du quartier.</li>
          <li><b>Simplicité</b> : une plateforme facile à utiliser, sans matériel imposé ni complexité inutile.</li>
        </ul>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Nos objectifs</h4>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Continuer à étendre la couverture de Fairide à davantage de communes bruxelloises.</li>
          <li>Lancer prochainement l'application mobile, disponible sur iOS, Android et AppGallery.</li>
          <li>Faire grandir le réseau de commerces et de livreurs partenaires, tout en conservant un modèle de commission juste et durable, pas seulement une offre de lancement.</li>
          <li>Rester fidèle, sur le long terme, à l'engagement d'une livraison à commission réduite.</li>
        </ul>
      </div>
    </div>
  );
}
