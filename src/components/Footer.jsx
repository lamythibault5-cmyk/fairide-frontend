import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import BrandMark from './BrandMark';

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col footer-brand">
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <BrandMark size={28} />
            <b style={{ fontSize: 19, letterSpacing: '-0.03em' }}>fairide</b>
          </div>
          <p className="small">{t('footer.tagline')}</p>
          <p className="small">{t('footer.belgian')}</p>
        </div>
        <div className="footer-col">
          <h4>{t('footer.join')}</h4>
          {/* Vers la liste, pas vers /login : c'était le seul lien « Commander » du pied de
              page et il menait à un mur de connexion, ce qui coupait le visiteur comme le robot
              du catalogue. */}
          <Link to="/restaurants" className="small">{t('footer.orderNow')}</Link>
          <Link to="/login?audience=partner&role=restaurant" className="small">{t('footer.addBusiness')}</Link>
          <Link to="/login?audience=partner&role=driver" className="small">{t('footer.becomeDriver')}</Link>
          {/* /notre-histoire et /aide n'étaient atteignables que depuis « Mon compte » et la
              recherche interne, c'est-à-dire uniquement pour quelqu'un de connecté : aucun lien
              crawlable n'y menait, et un robot n'est jamais connecté. Ce sont pourtant les deux
              pages publiques qui portent le plus de texte, donc celles qui peuvent se placer sur
              une recherche. */}
          <Link to="/notre-histoire" className="small">{t('accountUi.ourStory')}</Link>
          <Link to="/aide" className="small">{t('nav.help')}</Link>
        </div>
        <div className="footer-col">
          <h4>{t('footer.legalHeading')}</h4>
          <Link to="/mentions-legales" className="small">{t('footer.legalNotice')}</Link>
          <Link to="/confidentialite" className="small">{t('footer.privacy')}</Link>
          <Link to="/cgv" className="small">{t('footer.terms')}</Link>
          <Link to="/cookies" className="small">{t('footer.cookies')}</Link>
        </div>
      </div>
      <div className="footer-bottom small">{t('footer.bottom')}</div>
    </footer>
  );
}
