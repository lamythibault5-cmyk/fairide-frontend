import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mouvementReduit, vibrer } from '../gestes';

/* RETOUR PAR GLISSEMENT DEPUIS LE BORD GAUCHE — application iOS seulement (monté par Layout.jsx quand
 * plateforme() === 'ios').
 *
 * Android a ce geste dans le système (il produit un « retour » que natif.js transmet déjà au routeur). Sur iPhone, une
 * application d'une seule page dans une WebView ne l'a pas : on poussait le pouce depuis le bord par habitude et
 * rien ne venait. Ici la page suit le doigt 1:1 ; au lâcher, si l'élan l'emporte au-delà du tiers de l'écran, on
 * recule d'une page, sinon elle revient — à la vitesse du doigt, par le ressort (src/ressort.js, chargé à la
 * demande). Même sens à l'aller et au retour : la page part vers la droite, comme elle y était arrivée.
 *
 * Ne démarre pas : au-delà de 20 px du bord, quand une feuille ou un dialogue est ouvert, ou quand il n'y a pas de
 * page précédente dans l'application (première page). */
const BORD = 20;
const DEVIEE = 12; // au-delà, un mouvement plutôt vertical est un défilement, pas un retour

export default function RetourParGlissement() {
  const navigate = useNavigate();

  useEffect(() => {
    if (mouvementReduit()) return undefined;
    let m = null; let g = null;
    import('../ressort').then((mod) => { m = mod; }).catch(() => {});
    const cible = () => document.querySelector('.dashboard-main') || document.querySelector('main');
    // Bloqué par un dialogue MODAL (fiche d'un plat, sous-écran, confirmation) — pas par le bandeau cookies, qui est
    // un role="dialog" non modal posé en bas de l'écran.
    const peutReculer = () => (window.history.state?.idx ?? 0) > 0 && !document.querySelector('[aria-modal="true"], .plat-feuille');

    function debut(e) {
      const t = e.touches[0];
      if (t.clientX > BORD || !m || !peutReculer()) return;
      const el = cible(); if (!el) return;
      g = { x0: t.clientX, y0: t.clientY, el, x: 0, actif: false, suivi: m.suiviVitesse() };
      g.suivi.ajouter(t.clientX);
      document.addEventListener('touchmove', suite, { passive: false });
    }
    function suite(e) {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x0; const dy = t.clientY - g.y0;
      if (!g.actif) {
        if (Math.abs(dy) > DEVIEE && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
        if (dx < DEVIEE) return;
        g.actif = true;
        g.el.style.willChange = 'transform';
      }
      e.preventDefault();
      g.x = Math.max(0, dx);
      g.suivi.ajouter(t.clientX);
      g.el.style.transform = `translateX(${g.x}px)`;
    }
    function fin() {
      document.removeEventListener('touchmove', suite);
      if (!g) return;
      const { el, x, actif, suivi } = g; g = null;
      if (!actif) return;
      const largeur = window.innerWidth;
      const v = suivi.vitesse();
      const recule = x + m.projeter(v) > largeur / 3;
      const poser = (p) => { el.style.transform = p ? `translateX(${p}px)` : ''; };
      if (recule) vibrer(8);
      m.ressort({
        de: x, vers: recule ? largeur : 0, vitesse: v, amortissement: 1, reponse: recule ? 0.25 : 0.3, surImage: poser,
        fin: () => { el.style.willChange = ''; if (recule) { navigate(-1); requestAnimationFrame(() => poser(0)); } }
      });
    }

    // BLOQUANT SEULEMENT PENDANT LE GESTE (2026-10-23, app iPhone « 10 images par seconde ») : un écouteur touchmove non passif
    // posé en permanence sur le document obligeait iOS à attendre JavaScript avant CHAQUE défilement, partout. Il n'est
    // ajouté qu'au toucher qui part du bord gauche (debut), et retiré au lâcher (fin).
    document.addEventListener('touchstart', debut, { passive: true });
    document.addEventListener('touchend', fin, { passive: true });
    document.addEventListener('touchcancel', fin, { passive: true });
    return () => {
      document.removeEventListener('touchstart', debut);
      document.removeEventListener('touchmove', suite);
      document.removeEventListener('touchend', fin);
      document.removeEventListener('touchcancel', fin);
    };
  }, [navigate]);

  return null;
}
