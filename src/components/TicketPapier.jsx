import '../terminal.css';
import { qrSvgPath } from './qr';
import BrandMark from './BrandMark';

// Un ticket du terminal Fairide, dessiné à l'écran À PARTIR DES MÊMES LIGNES que celles envoyées à l'imprimante
// (backend ticketTerminal.js, mettreEnPage) : ce qu'on voit ici est ce qui sort sur le rouleau de 58 mm.
// Largeur en `ch` (une colonne = un caractère) ; la taille 2 double la largeur ET la hauteur, comme sur le papier.
export default function TicketPapier({ lines = [], columns = 32, className = '', label }) {
  return (
    <div className={`ticket-papier ${className}`} style={{ '--cols': columns }} role="img" aria-label={label || (lines.find((x) => x.t === 'text' && x.size === 2)?.text) || undefined}>
      {lines.map((x, i) => {
        if (x.t === 'rule') return <div key={i} className="tp-trait" aria-hidden="true">{x.char.repeat(columns)}</div>;
        if (x.t === 'feed') return <div key={i} className="tp-avance" style={{ height: `${x.lines * 1.2}em` }} aria-hidden="true" />;
        // Logo Fairide en tête du ticket (fondateur, 2026-10-06) : dessiné en noir, comme le reste du rouleau.
        if (x.t === 'logo') return <div key={i} className="tp-logo" aria-label="Fairide"><BrandMark size={40} /></div>;
        if (x.t === 'qr') {
          const qr = qrSvgPath(x.data);
          return (
            <div key={i} className="tp-qr">
              {qr && <svg viewBox={qr.viewBox} width="96" height="96" role="img" aria-label={x.caption}><path d={qr.d} fill="currentColor" /></svg>}
              <div className="tp-legende">{x.caption}</div>
            </div>
          );
        }
        return (
          <div key={i} className={`tp-ligne tp-${x.align}${x.size === 2 ? ' tp-grand' : ''}${x.bold ? ' tp-gras' : ''}${x.inverse ? ' tp-inverse' : ''}`}>
            {x.text || ' '}
          </div>
        );
      })}
    </div>
  );
}
