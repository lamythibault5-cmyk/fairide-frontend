import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import Icone from '../components/Icone';
import usePageMeta from '../hooks/usePageMeta';

// Route attrape-tout. vercel.json réécrit TOUTE URL vers index.html (comportement normal d'une SPA),
// donc sans route "*" une adresse inconnue — faute de frappe, ancien lien, QR code périmé — affichait
// l'en-tête et le pied de page autour d'un vide, sans message ni moyen de repartir.
export default function NotFound() {
  const { t } = useLanguage();
  // Une page introuvable ne s'indexe pas et ne garde pas le titre de la page précédente.
  usePageMeta({ title: t('seo.notFoundTitle'), path: '/404', robots: 'noindex, follow' });
  return (
    <div className="center-page">
      {/* Une icone dans un rond, comme sur le resultat d'une commande et les ecrans vides :
          l'emoji de 40px etait rendu par la police du systeme, donc different sur chaque machine. */}
      <span className="etat-vide-icone" aria-hidden="true"><Icone nom="recherche" taille={34} /></span>
      <h1 className="etat-vide-titre">{t('notFound.title')}</h1>
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
