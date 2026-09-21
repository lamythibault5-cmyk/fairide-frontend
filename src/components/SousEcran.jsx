import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import useDialogue from '../hooks/useDialogue';

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
export default function SousEcran({ titre, onFermer, children, pied = null }) {
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
  useDialogue(racine, onFermer);

  return createPortal(
    <div className="plat-feuille" role="dialog" aria-modal="true" aria-label={titre} ref={racine} tabIndex={-1}>
      <div className="plat-panneau">
        <div className="sous-ecran-tete">
          <button type="button" className="flux-bouton" onClick={onFermer} aria-label={t('common.close')} title={t('common.close')}>
            <span aria-hidden="true">‹</span>
          </button>
          <span className="flux-titre">{titre}</span>
        </div>
        <div className="plat-defile">
          <div className="plat-corps">{children}</div>
        </div>
        {/* Le pied n'existe que si l'appelant en donne un : certains sous-écrans se referment d'eux-
            mêmes au choix (les options de remise), d'autres ont besoin d'un « Enregistrer ». */}
        {pied && <div className="plat-pied">{pied}</div>}
      </div>
    </div>,
    document.body
  );
}
