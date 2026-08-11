import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col footer-brand">
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <BrandMark size={28} />
            <b style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>Fairide</b>
          </div>
          <p className="small">La livraison de repas et de commerces locaux à commission réduite, à Bruxelles.</p>
        </div>
        <div className="footer-col">
          <h4>Rejoindre</h4>
          <Link to="/login?audience=client" className="small">Commander maintenant</Link>
          <Link to="/login?audience=partner&role=restaurant" className="small">Ajouter mon commerce</Link>
          <Link to="/login?audience=partner&role=driver" className="small">Devenir livreur</Link>
        </div>
        <div className="footer-col">
          <h4>Fairide</h4>
          <Link to="/mentions-legales" className="small">Mentions légales</Link>
          <Link to="/confidentialite" className="small">Confidentialité</Link>
          <Link to="/cgv" className="small">CGV</Link>
        </div>
      </div>
      <div className="footer-bottom small">Fairide — la livraison de repas à commission réduite.</div>
    </footer>
  );
}
