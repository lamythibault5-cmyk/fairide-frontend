import { Link, useSearchParams } from 'react-router-dom';

export default function OrderResult({ success }) {
  const [params] = useSearchParams();
  const orderId = params.get('order');

  return (
    <div className="center-page">
      <div style={{ fontSize: 40 }}>{success ? '🎉' : '😕'}</div>
      <h2>{success ? 'Paiement confirmé !' : 'Paiement annulé'}</h2>
      <p className="small">
        {success
          ? 'Ta commande a bien été enregistrée et payée.'
          : "Le paiement n'a pas été finalisé — ta commande reste en attente."}
        {orderId && <><br />Commande n°{orderId.slice(0, 8)}</>}
      </p>
      <Link to="/orders" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
        Voir mes commandes
      </Link>
    </div>
  );
}
