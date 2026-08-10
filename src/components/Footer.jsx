import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 40, padding: '20px 0', textAlign: 'center' }}>
      <div className="row" style={{ justifyContent: 'center', gap: 16, marginBottom: 6 }}>
        <Link to="/mentions-legales" className="small">Mentions légales</Link>
        <Link to="/confidentialite" className="small">Confidentialité</Link>
        <Link to="/cgv" className="small">CGV</Link>
      </div>
      <div className="small">Fairide — la livraison de repas à commission réduite.</div>
    </footer>
  );
}
