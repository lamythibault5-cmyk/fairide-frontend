import { useLanguage } from '../../context/LanguageContext';
import Icone from '../../components/Icone';
import usePageMeta from '../../hooks/usePageMeta';
import { ouvrirLienExterne } from '../../natif';

// LA CONSOLE D'ADMINISTRATION N'EXISTE QUE SUR LE SITE (Owen, 2026-10-20 : « je ne veux pas d'admin dans l'application »).
// Dans l'application (experienceApp), toute adresse /admin… affiche cet écran à la place de la console : un message et un
// bouton qui ouvre fairide.be/admin dans le navigateur. Rien de la console n'est chargé (App.jsx ne monte pas AdminLayout).
const URL_CONSOLE = 'https://fairide.be/admin';

export default function AdminSurLeSite() {
  const { t } = useLanguage();
  usePageMeta({ title: t('adminSurLeSite.title'), robots: 'noindex, nofollow' });
  return (
    <div className="center-page">
      <span className="etat-vide-icone" aria-hidden="true"><Icone nom="reglages" taille={34} /></span>
      <h1 className="etat-vide-titre">{t('adminSurLeSite.title')}</h1>
      <p className="small" style={{ maxWidth: 420, margin: '0 auto 20px' }}>{t('adminSurLeSite.text')}</p>
      <button type="button" className="btn-gold" onClick={() => ouvrirLienExterne(URL_CONSOLE)}>{t('adminSurLeSite.open')}</button>
    </div>
  );
}
