import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import Icone from '../components/Icone';

// Route attrape-tout. vercel.json réécrit TOUTE URL vers index.html (comportement normal d'une SPA),
// donc sans route "*" une adresse inconnue — faute de frappe, ancien lien, QR code périmé — affichait
// l'en-tête et le pied de page autour d'un vide, sans message ni moyen de repartir.
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="center-page">
      {/* Une icone dans un rond, comme sur le resultat d'une commande et les ecrans vides :
          l'emoji de 40px etait rendu par la police du systeme, donc different sur chaque machine. */}
      <span className="etat-vide-icone" aria-hidden="true"><Icone nom="recherche" taille={34} /></span>
      <h2 className="etat-vide-titre">{t('notFound.title')}</h2>
      <p className="small" style={{ maxWidth: 420, margin: '0 auto 20px' }}>{t('notFound.text')}</p>
      <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
        <Link to="/restaurants" className="btn-gold" style={{ textDecoration: 'none', display: 'inline-block' }}>
          {t('notFound.browseRestaurants')}
        </Link>
        <Link to="/" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
          {t('notFound.backHome')}
        </Link>
      </div>
    </div>
  );
}
