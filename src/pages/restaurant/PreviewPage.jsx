import { useOutletContext } from 'react-router-dom';
import RestaurantPreview from '../../components/RestaurantPreview';

export default function PreviewPage() {
  const { restaurant } = useOutletContext();

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Aperçu — vue client</h2>
      <p className="small" style={{ margin: '0 0 14px' }}>Exactement ce que voient tes clients quand ils visitent ta page.</p>
      <div className="card" style={{ border: '2px solid var(--ink)' }}>
        <RestaurantPreview restaurant={restaurant} />
      </div>
    </div>
  );
}
