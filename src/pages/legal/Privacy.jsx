export default function Privacy() {
  return (
    <div className="card">
      <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
        ⚠️ Document de travail — à faire relire et compléter par un professionnel (conformité RGPD) avant publication réelle.
      </div>
      <h2 style={{ marginTop: 0 }}>Politique de confidentialité</h2>

      <h3>Données collectées</h3>
      <p className="small">
        Lors de l'inscription et de l'utilisation de Fairide, nous collectons : nom, prénom, email, téléphone, adresse postale,
        éventuellement genre et date de naissance, ainsi que l'historique de commandes et les avis laissés. Pour la connexion Google,
        nous recevons votre nom et votre email depuis Google.
      </p>

      <h3>Finalité du traitement</h3>
      <p className="small">
        Ces données servent à : créer et gérer votre compte, traiter vos commandes et paiements, permettre la livraison,
        vous envoyer des emails liés à vos commandes, et améliorer le service.
      </p>

      <h3>Partage des données</h3>
      <p className="small">
        Les données nécessaires à la livraison (nom, adresse, téléphone) sont partagées avec le commerce partenaire et le livreur
        concernés par votre commande. Les paiements sont traités par Stripe. Les emails sont envoyés via Resend. Fairide ne vend
        aucune donnée personnelle à des tiers.
      </p>

      <h3>Conservation</h3>
      <p className="small">
        Les données de compte sont conservées tant que le compte est actif. Vous pouvez demander la suppression de votre compte
        et de vos données à contact@fairide.be, sous réserve des obligations légales de conservation (facturation notamment).
      </p>

      <h3>Vos droits</h3>
      <p className="small">
        Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données.
        Pour exercer ces droits, contactez-nous à contact@fairide.be.
      </p>

      <h3>Cookies</h3>
      <p className="small">
        Fairide utilise uniquement des cookies techniques nécessaires au fonctionnement du site (session de connexion).
        Aucun cookie publicitaire ou de tracking tiers n'est utilisé à ce stade.
      </p>
    </div>
  );
}
