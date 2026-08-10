export default function Terms() {
  return (
    <div className="card">
      <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
        ⚠️ Document de travail — à faire relire et compléter par un professionnel avant publication réelle.
      </div>
      <h2 style={{ marginTop: 0 }}>Conditions générales d'utilisation et de vente</h2>

      <h3>1. Objet</h3>
      <p className="small">
        Fairide est une plateforme mettant en relation des clients, des commerces locaux partenaires (restaurants, supermarchés, commerces de proximité)
        et des livreurs indépendants, pour la commande et la livraison de produits. Fairide n'est ni un restaurant, ni un service de livraison :
        elle fournit uniquement l'outil technique de mise en relation et de paiement.
      </p>

      <h3>2. Compte utilisateur</h3>
      <p className="small">
        L'inscription nécessite des informations exactes (identité, coordonnées, adresse). Chaque utilisateur est responsable de la confidentialité
        de ses identifiants et des actions effectuées depuis son compte.
      </p>

      <h3>3. Commandes et paiement</h3>
      <p className="small">
        Les prix affichés incluent le prix des produits fixé par le commerce partenaire et des frais de livraison. Le paiement est réalisé en ligne
        via notre prestataire de paiement (Stripe) au moment de la commande. Une commande n'est confirmée qu'une fois le paiement validé.
      </p>

      <h3>4. Solde Fairide</h3>
      <p className="small">
        Un client peut disposer d'un solde crédité par Fairide (promotion, code parrainage, geste commercial). Ce solde n'est pas convertible en
        espèces, n'est pas transférable, et ne peut être utilisé que pour des commandes sur la plateforme.
      </p>

      <h3>5. Commission</h3>
      <p className="small">
        Fairide perçoit une commission sur chaque commande payée par un commerce partenaire, dont le taux est communiqué au commerce lors
        de son inscription.
      </p>

      <h3>6. Annulation et remboursement</h3>
      <p className="small">
        Un commerce partenaire peut refuser une commande avant de la préparer ; dans ce cas, le client est intégralement remboursé
        (montant payé et solde éventuellement utilisé). Passé ce stade, l'annulation n'est plus possible.
      </p>

      <h3>7. Avis clients</h3>
      <p className="small">
        Les avis publiés doivent être sincères et respectueux. Fairide se réserve le droit de retirer tout avis manifestement abusif,
        diffamatoire ou hors sujet.
      </p>

      <h3>8. Responsabilité</h3>
      <p className="small">
        Fairide met tout en œuvre pour assurer le bon fonctionnement de la plateforme mais ne garantit pas une disponibilité continue du service.
        Fairide n'est pas responsable de la qualité des produits fournis par les commerces partenaires ni des délais de livraison,
        qui dépendent de tiers indépendants.
      </p>

      <h3>9. Droit applicable</h3>
      <p className="small">Les présentes conditions sont soumises au droit belge. Tout litige relève des tribunaux compétents de [ville].</p>
    </div>
  );
}
