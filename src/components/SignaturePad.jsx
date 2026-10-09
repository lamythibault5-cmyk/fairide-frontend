import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Cadre de signature (fondateur, 2026-10-09) : on signe avec le doigt ou la souris, le trait part en PNG au serveur,
// qui l'archive avec le contrat et l'imprime dans le PDF. onChange(dataUrl | null) à chaque trait et à l'effacement.
export default function SignaturePad({ onChange, hauteur = 160 }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const dessin = useRef({ actif: false, traits: 0 });
  const [vide, setVide] = useState(true);

  // Trace net sur écran dense : la toile est dessinée à la densité de l'écran, affichée à sa taille CSS.
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const largeur = c.clientWidth || 500;
    c.width = Math.round(largeur * ratio); c.height = Math.round(hauteur * ratio);
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, largeur, hauteur);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#16233A';
  }, [hauteur]);

  const point = (e) => {
    const c = canvasRef.current; const r = c.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };
  const debut = (e) => { e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = point(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); dessin.current.actif = true; };
  const trace = (e) => { if (!dessin.current.actif) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dessin.current.traits++; };
  const fin = () => {
    if (!dessin.current.actif) return;
    dessin.current.actif = false;
    if (dessin.current.traits >= 1) { setVide(false); onChange?.(canvasRef.current.toDataURL('image/png')); }
  };
  const effacer = () => {
    const c = canvasRef.current; const ctx = c.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
    dessin.current.traits = 0; setVide(true); onChange?.(null);
  };

  return (
    <div className="signature-pad">
      <p className="small" style={{ margin: '0 0 6px' }}>✍️ {t('signature.help')}</p>
      <canvas
        ref={canvasRef}
        role="img" aria-label={t('signature.aria')}
        style={{ width: '100%', height: hauteur, border: '2px dashed var(--iris, #3B2FB5)', borderRadius: 12, background: '#fff', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={debut} onMouseMove={trace} onMouseUp={fin} onMouseLeave={fin}
        onTouchStart={debut} onTouchMove={trace} onTouchEnd={fin} onTouchCancel={fin}
      />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
        <span className="small" style={{ opacity: 0.75 }}>{vide ? t('signature.empty') : t('signature.done')}</span>
        <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={effacer}>{t('signature.clear')}</button>
      </div>
    </div>
  );
}
