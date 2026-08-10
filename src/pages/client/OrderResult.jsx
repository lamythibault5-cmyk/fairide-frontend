import { Link, useSearchParams } from 'react-router-dom';

export default function OrderResult({ success }) {
  const [params] = useSearchParams();
  const orderId = params.get('order');

  return (
    <div className="center-page">
      <div style={{ fontSize: 40 }}>{success ? '🎉' : '😕'}</div>
      <h2>{success ? 'Merci pour ta commande !' : 'Paiement annulé'}</h2>
      <p className="small">
        {success
          ? 'Ton paiement a bien été reçu et ta commande est en route vers le restaurant. Tu vas recevoir un email avec le récapitulatif et ton code de livraison.'
          : "Le paiement n'a pas été finalisé — ta commande reste en attente."}
        {orderId && <><br />Commande n°{orderId.slice(0, 8)}</>}
      </p>
      <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
        <Link to="/orders" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Voir mes commandes
        </Link>
        <Link to="/restaurants" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
          ← Retour aux restaurants
        </Link>
      </div>
    </div>
  );
}
