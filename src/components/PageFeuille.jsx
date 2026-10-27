import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import useDialogue from '../hooks/useDialogue';
import useFeuilleGlissable from '../hooks/useFeuilleGlissable';
import { mouvementReduit } from '../gestes';
import Icone from './Icone';

/* UNE PAGE EN FEUILLE (feuilles.js) : Favoris, Mes commandes, Mes factures… ouverts depuis Mon compte montent par-dessus,
 * comme « Mes infos ». Même feuille que la fiche d'un plat et les sous-écrans (classes plat-feuille / plat-panneau, geste
 * useFeuilleGlissable : tirer vers le bas ferme, physique dans l'app), la poignée en haut, et un rond ‹ pour qui ne tire
 * pas. Fermer, c'est revenir d'un pas dans l'historique : on retrouve la page de fond, à sa place.
 *
 * Sous les fenêtres ordinaires (z-index 90 contre 100, page-feuille dans styles.css) : une confirmation ou un sous-écran
 * ouverts depuis la page s'affichent au-dessus d'elle. */
export default function PageFeuille({ titre, children }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const racine = useRef(null);
  const panneau = useRef(null);
  const defile = useRef(null);
  const [ferme, setFerme] = useState(false);
  /* Le ‹ est en verre blanc, fait pour le bandeau iris du haut de chaque page. Une fois le bandeau défilé sous lui, il était
   * posé sur la feuille blanche et ne se voyait plus : plus de sortie visible au milieu de Mes commandes (fondateur,
   * 2026-10-27, « il se sent perdu »). Il passe alors au verre clair (verre.css). */
  const [surBlanc, setSurBlanc] = useState(false);
  function surDefilement(e) {
    const bandeau = e.currentTarget.querySelector('.ecran-bandeau, .ec-bandeau, .ecl-bandeau, .gn-bandeau');
    const bas = bandeau ? bandeau.getBoundingClientRect().bottom - e.currentTarget.getBoundingClientRect().top : 0;
    // 68 px : le bas du ‹ (12 px du bord, 44 px de haut) et un peu d'air.
    setSurBlanc(bas < 68);
  }
  const fermerTout = () => navigate(-1);
  function fermerAnime() {
    if (ferme) return;
    if (mouvementReduit()) { fermerTout(); return; }
    setFerme(true);
    setTimeout(fermerTout, 230);
  }
  useDialogue(racine, fermerAnime);
  const glisser = useFeuilleGlissable({ panneau, defile, fermerAnime, fermerTout });
  return (
    <div className={`plat-feuille page-feuille${surBlanc ? ' page-feuille--sur-blanc' : ''}${ferme ? ' plat-feuille--ferme' : ''}`} role="dialog" aria-modal="true" aria-label={titre} ref={racine} tabIndex={-1}>
      <div className="plat-panneau" ref={panneau} {...glisser}>
        <span className="plat-poignee" aria-hidden="true" />
        <button type="button" className="page-feuille-fermer" onClick={fermerAnime} aria-label={t('common.close')} title={t('common.close')}>
          <Icone nom="retour" taille={20} />
        </button>
        <div className="plat-defile page-feuille-defile" ref={defile} onScroll={surDefilement}>
          <div className="page-feuille-corps">{children}</div>
        </div>
      </div>
    </div>
  );
}
