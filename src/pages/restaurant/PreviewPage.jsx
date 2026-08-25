import { useOutletContext, useNavigate } from 'react-router-dom';
import { usePreviewMode } from '../../context/PreviewModeContext';
import RestaurantPreview from '../../components/RestaurantPreview';

export default function PreviewPage() {
  const { restaurant } = useOutletContext();
  const { enterPreview } = usePreviewMode();
  const navigate = useNavigate();

  function tryAsClient() {
    enterPreview();
    navigate('/restaurants');
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Aperçu — vue client</h2>
      <p className="small" style={{ margin: '0 0 14px' }}>Exactement ce que voient tes clients quand ils visitent ta page.</p>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>👁️ Essayer toute l'app en tant que client</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Parcours l'app entière comme un client — liste des restos, favoris, suivi de commande, carte — avec ta propre barre de navigation qui devient temporairement celle d'un client. Aucune vraie commande ne peut être passée : le paiement est bloqué à la toute fin, exactement là où un client réel serait redirigé vers Stripe.
        </p>
        <button type="button" className="btn-outline" onClick={tryAsClient}>👁️ Essayer en tant que client</button>
      </div>
      <div className="card" style={{ border: '2px solid var(--ink)' }}>
        <RestaurantPreview restaurant={restaurant} />
      </div>
    </div>
  );
}
