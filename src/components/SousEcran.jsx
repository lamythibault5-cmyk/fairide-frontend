import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import useDialogue from '../hooks/useDialogue';
import useFeuilleGlissable from '../hooks/useFeuilleGlissable';
import { mouvementReduit } from '../gestes';
import ConfirmDialog from './ConfirmDialog';

// Un sous-écran du paiement : l'adresse, les options de remise.
//
// POURQUOI CE MOTIF. Le paiement d'Uber Eats n'est pas un formulaire déroulant, et ce n'est pas non
// plus un assistant en étapes : c'est UNE page faite de rangées qui résument une décision déjà prise
// (« Av. des Rogations 52 », « Leave at my door »), et chaque rangée ouvre un écran pour la changer.
//
// La différence n'est pas cosmétique. Un assistant impose de traverser chaque question dans l'ordre,
// même celles dont la réponse par défaut convenait ; ces rangées montrent d'emblée l'état complet de
// la commande, et on n'ouvre que ce qu'on veut corriger. Sur un paiement où presque tout est déjà
// connu — l'adresse vient du compte, la remise a un défaut — c'est la bonne forme.
//
// Reprend la géométrie de la fiche d'un plat (FichePlat) : plein écran sur téléphone, panneau centré
// sur ordinateur, fermeture par la croix ou par Échap. Un seul geste à apprendre pour tout le site.
// `modifie` (facultatif) : l'écran a une saisie pas encore enregistrée. Le fermer (‹, Échap, tirer vers le bas) demande alors
// « Quitter sans enregistrer ? » au lieu de tout perdre (audit du 19/10, shop-321 : sept jours d'horaires saisis, la feuille
// tirée vers le bas en remontant, tout parti). « Enregistrer » ferme toujours sans rien demander : il passe par onFermer.
export default function SousEcran({ titre, onFermer, children, pied = null, modifie = false }) {
  const { t } = useLanguage();
  const racine = useRef(null);

  /* LE FOCUS SE POSE UNE SEULE FOIS, AU MONTAGE — la règle est maintenant tenue par le hook, mais
   * elle est née ici et la raison mérite de rester écrite à l'endroit où le défaut s'est vu.
   *
   * Avant, un seul effet faisait le tout, avec `onFermer` en dépendance. Or l'appelant écrit
   * `onFermer={() => setX(null)}` : une NOUVELLE fonction à chaque rendu. L'effet rejouait donc à
   * chaque frappe et rappelait `racine.current.focus()`, qui ramenait le focus du champ de saisie
   * vers le dialogue. Symptôme à l'écran : on tapait un caractère, puis il fallait recliquer dans le
   * champ pour le suivant — signalé par le fondateur sur le numéro de rue (2026-09-17).
   *
   * useDialogue garde cette séparation (voir son en-tête) et ajoute le piège à focus et le retour du
   * focus au bouton d'ouverture. Ce sous-écran contient des champs de saisie : c'est précisément
   * celui où un effet mal découpé se verrait le plus vite. */
  // SORTIE ANIMÉE, comme la fiche d'un plat (audit du 15/10/2026) : le sous-écran montait du bas mais s'éteignait d'un coup
  // au ‹ ou à Échap. Il redescend (mêmes classes que FichePlat), puis l'appelant le démonte. Sans mouvement : tout de suite.
  // Une fermeture décidée par l'appelant (« Enregistrer ») reste immédiate : rien n'attend une animation pour agir.
  const [ferme, setFerme] = useState(false);
  function fermerAnime() {
    if (ferme) return;
    if (mouvementReduit()) { onFermer(); return; }
    setFerme(true);
    setTimeout(onFermer, 230);
  }
  const panneau = useRef(null);
  const [aConfirmer, setAConfirmer] = useState(false);
  // Saisie en cours : on remet la feuille en place (elle a pu partir sous le doigt) et on demande, au lieu de fermer.
  function demander(fermeture) {
    if (!modifie) { fermeture(); return; }
    if (panneau.current) { panneau.current.style.transition = ''; panneau.current.style.transform = ''; panneau.current.style.boxShadow = ''; }
    setAConfirmer(true);
  }
  useDialogue(racine, () => { if (!aConfirmer) demander(fermerAnime); });
  // Même geste que la fiche d'un plat : tirer vers le bas ferme (physique dans l'application, voir le hook). Fermé par le
  // ressort, le panneau est déjà hors de l'écran : on ferme sans rejouer la sortie (fermerTout).
  const defile = useRef(null);
  const glisser = useFeuilleGlissable({ panneau, defile, fermerAnime: () => demander(fermerAnime), fermerTout: () => demander(onFermer) });

  return createPortal(
    <div className={`plat-feuille sous-ecran-feuille${ferme ? ' plat-feuille--ferme' : ''}`} role="dialog" aria-modal="true" aria-label={titre} ref={racine} tabIndex={-1}>
      <div className="plat-panneau" ref={panneau} {...glisser}>
        <span className="sous-ecran-poignee" aria-hidden="true" />
        <div className="sous-ecran-tete">
          <button type="button" className="flux-bouton" onClick={() => demander(fermerAnime)} aria-label={t('common.close')} title={t('common.close')}>
            <span aria-hidden="true">‹</span>
          </button>
          <span className="flux-titre">{titre}</span>
        </div>
        <div className="plat-defile" ref={defile}>
          <div className="plat-corps">{children}</div>
        </div>
        {/* Le pied n'existe que si l'appelant en donne un : certains sous-écrans se referment d'eux-
            mêmes au choix (les options de remise), d'autres ont besoin d'un « Enregistrer ». */}
        {pied && <div className="plat-pied">{pied}</div>}
      </div>
      <ConfirmDialog open={aConfirmer} danger title={t('common.leaveUnsavedTitle')} message={t('common.leaveUnsavedText')}
        confirmLabel={t('common.leaveUnsavedConfirm')} cancelLabel={t('common.leaveUnsavedCancel')}
        onCancel={() => setAConfirmer(false)} onConfirm={() => { setAConfirmer(false); fermerAnime(); }} />
    </div>,
    document.body
  );
}
