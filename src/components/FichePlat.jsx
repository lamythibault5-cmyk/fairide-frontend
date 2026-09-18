import { useEffect, useRef, useState } from 'react';
import { imgProps } from '../images';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';

// LA FICHE D'UN PLAT. Jusqu'ici, un plat n'avait aucun écran à lui.
//
// La carte du plat ÉTAIT le bouton : taper dessus l'ajoutait au panier séance tenante. On ne pouvait
// donc ni lire la description en entier, ni voir la photo en grand, ni en prendre deux — il fallait
// taper trois fois. Les plats à options ouvraient bien une fenêtre, mais sans photo, sans description
// après la première étape, et sans quantité : c'était un formulaire, pas une fiche.
//
// D'où cet écran, calqué sur celui d'Uber Eats (captures du fondateur) : la photo en grand, le nom,
// le prix, la description, les groupes d'options, le sélecteur de quantité, et une action collée en
// bas qui annonce ce qu'on ajoute ET ce que ça coûte.
//
// UN SEUL DÉFILEMENT, ALORS QUE L'ANCIENNE FENÊTRE PROCÉDAIT PAR ÉTAPES — et ce n'est pas un oubli.
// Le découpage en étapes réglait un vrai problème, que l'ancienne fenêtre documentait : empilés, les
// groupes dépassaient l'écran et le bouton « Ajouter » se retrouvait hors champ. Ici l'action est
// COLLÉE EN BAS : elle reste visible quoi qu'on fasse défiler. La raison d'être des étapes disparaît
// donc, et on récupère ce qu'elles coûtaient — voir tous ses choix d'un coup, et pouvoir revenir sur
// le premier sans traverser les autres.
//
// Le bouton est lime (.btn-gold) et non noir comme chez Uber : ajouter au panier est l'action
// décisive de cet écran, et c'est la règle de CLAUDE.md (arbitrage du fondateur, 2026-09-17). On
// garde la STRUCTURE d'Uber — collée en bas, prix dans le libellé — et la couleur de Fairide.
export default function FichePlat({ item, imageUrl, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const groups = item.optionGroups || [];
  const [selections, setSelections] = useState(() => {
    const init = {};
    groups.forEach((g) => { init[g.id] = new Set(); });
    return init;
  });
  const [qty, setQty] = useState(1);
  const racine = useRef(null);

  // Échap ferme, et le fond de page ne défile plus derrière la feuille — même geste que la vue
  // agrandie du suivi (TrackingWithGames.jsx), pour que la fermeture s'apprenne une seule fois.
  // Deux effets séparés, pour la même raison que dans SousEcran.jsx : `onCancel` est une nouvelle
  // fonction à chaque rendu, donc un effet unique qui en dépend rejouerait `focus()` à chaque frappe
  // et volerait le focus des champs. Ici la fiche n'a pas encore de champ de saisie, mais le défaut
  // est le même et il apparaîtrait au premier ajouté.
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    racine.current?.focus();
    return () => { document.body.style.overflow = avant; };
  }, []);

  useEffect(() => {
    const surTouche = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onCancel]);

  function choisirUnique(groupId, optionId) {
    setSelections((prev) => ({ ...prev, [groupId]: new Set([optionId]) }));
  }
  function basculerMultiple(groupId, optionId, maxSelections) {
    setSelections((prev) => {
      const next = new Set(prev[groupId]);
      if (next.has(optionId)) next.delete(optionId);
      else {
        if (maxSelections && next.size >= maxSelections) return prev;
        next.add(optionId);
      }
      return { ...prev, [groupId]: next };
    });
  }

  let delta = 0;
  const snapshot = [];
  const optionItemIds = [];
  groups.forEach((g) => {
    g.items.forEach((i) => {
      if (selections[g.id].has(i.id)) {
        delta += i.priceDelta;
        snapshot.push({ groupName: g.name, name: i.name, priceDelta: i.priceDelta });
        optionItemIds.push(i.id);
      }
    });
  });
  const prixUnite = +(item.price + delta).toFixed(2);
  const total = +(prixUnite * qty).toFixed(2);
  const manquants = groups.filter((g) => g.required && selections[g.id].size === 0);
  const bloque = manquants.length > 0;

  return createPortal(
    <div className="plat-feuille" role="dialog" aria-modal="true" aria-label={item.name} ref={racine} tabIndex={-1}>
      {/* Le panneau : plein écran sur téléphone, encadré et centré au-dessus de la page sur
          ordinateur (voir styles.css). Sans lui, la fiche s'étalait sur 1400px pour un plat. */}
      <div className="plat-panneau">
      <div className="plat-defile">
        {/* La photo d'abord, en grand : c'est ce qu'on vient voir. Sans photo, pas de cadre vide —
            l'écran commence simplement au nom. */}
        {imageUrl && (
          <div className="plat-photo">
            <img {...imgProps(imageUrl, 800, '(max-width: 640px) 100vw, 800px')} alt={item.name} decoding="async" />
          </div>
        )}
        {/* La croix flotte par-dessus la photo quand il y en a une, comme chez Uber. Elle reprend la
            géométrie du bouton du parcours (EnteteFlux) pour que ce soit le même geste. */}
        <button
          type="button"
          className={`plat-fermer${imageUrl ? ' plat-fermer--sur-photo' : ''}`}
          onClick={onCancel}
          aria-label={t('common.close')}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="plat-corps">
          <h2 className="plat-nom">{item.name}</h2>
          <div className="plat-prix">{item.price.toFixed(2)}€</div>
          {item.desc && <p className="plat-desc">{item.desc}</p>}

          {groups.map((g) => {
            const choisis = selections[g.id];
            const requisNonRempli = g.required && choisis.size === 0;
            return (
              <div key={g.id} className="plat-groupe">
                <div className="plat-groupe-tete">
                  <b>{g.name}</b>
                  {g.required && (
                    <span className={`plat-requis${requisNonRempli ? ' plat-requis--manquant' : ''}`}>
                      {t('optionsPicker.required')}
                    </span>
                  )}
                </div>
                {g.type === 'multiple' && g.maxSelections && (
                  <p className="plat-groupe-aide">{t('optionsPicker.maxChoices', { max: g.maxSelections, plural: g.maxSelections > 1 ? 's' : '' })}</p>
                )}
                {g.items.map((i) => {
                  const auMax = g.type === 'multiple' && g.maxSelections && choisis.size >= g.maxSelections && !choisis.has(i.id);
                  return (
                    <label key={i.id} className={`plat-option${auMax ? ' plat-option--max' : ''}`}>
                      <span className="plat-option-gauche">
                        <input
                          type={g.type === 'single' ? 'radio' : 'checkbox'}
                          name={g.type === 'single' ? g.id : undefined}
                          checked={choisis.has(i.id)}
                          disabled={auMax}
                          onChange={() => (g.type === 'single' ? choisirUnique(g.id, i.id) : basculerMultiple(g.id, i.id, g.maxSelections))}
                        />
                        <span>{i.name}</span>
                      </span>
                      {i.priceDelta !== 0 && <span className="plat-option-prix">{i.priceDelta > 0 ? '+' : ''}{i.priceDelta.toFixed(2)}€</span>}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* L'action reste collée en bas : c'est elle qui rend le défilement unique possible. */}
      <div className="plat-pied">
        {/* Pourquoi on ne peut pas ajouter — DANS le pied, au-dessus du bouton. Placée après, elle
            serait tombée sous la barre collante, donc hors de l'écran : un bouton grisé sans la
            moindre explication, exactement ce qu'on cherchait à éviter. */}
        {bloque && <p className="plat-bloque">{t('platSheet.chooseRequired', { groupe: manquants[0].name })}</p>}
        <div className="plat-quantite" role="group" aria-label={t('platSheet.quantity')}>
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label={t('platSheet.less')}>−</button>
          <span aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={qty >= 99} aria-label={t('platSheet.more')}>+</button>
        </div>
        <button
          type="button"
          className="btn-gold plat-ajouter"
          disabled={bloque}
          onClick={() => onConfirm(optionItemIds, snapshot, prixUnite, qty)}
        >
          {/* Le libellé annonce la quantité ET le prix : on sait ce qu'on ajoute sans remonter. */}
          {t('platSheet.add', { n: qty })} · {total.toFixed(2)}€
        </button>
      </div>
      </div>
    </div>,
    document.body
  );
}
