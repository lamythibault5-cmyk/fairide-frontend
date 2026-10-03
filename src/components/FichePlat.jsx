import { useRef, useState } from 'react';
import { imgProps } from '../images';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import useDialogue from '../hooks/useDialogue';
import { libellesAllergenes } from '../allergenes';
import { prixRemise, euros } from '../prixPlat';
import { envolerVersPanier, mouvementReduit, vibrer } from '../gestes';

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
  // Précision du client pour ce plat (« sans oignon » — plan de test MNU-5) : imprimée sur le ticket, 140 caractères.
  const [note, setNote] = useState('');
  const racine = useRef(null);
  const panneau = useRef(null);
  const defile = useRef(null);
  const boutonAjouter = useRef(null);
  const [ferme, setFerme] = useState(false);

  // SORTIE ANIMÉE : la feuille redescend avant de disparaître (et s'efface sur ordinateur), au lieu de s'éteindre
  // d'un coup. `apres` part une fois l'animation finie ; sans mouvement, tout de suite.
  function fermer(apres) {
    if (ferme) return;
    if (mouvementReduit()) { apres(); return; }
    setFerme(true);
    setTimeout(apres, 230);
  }
  const annuler = () => fermer(onCancel);

  // GLISSER VERS LE BAS POUR FERMER (téléphone) : le geste natif d'une feuille. Il ne démarre que si la fiche est
  // tout en haut — sinon on fait simplement défiler les options. Au-delà de 110px, ou lancé vite, la fiche part ;
  // en deçà, elle revient en place.
  const glisse = useRef(null);
  function debutGlisse(e) {
    if (window.innerWidth > 900 || (defile.current && defile.current.scrollTop > 0)) return;
    glisse.current = { y0: e.touches[0].clientY, t0: Date.now(), dy: 0 };
  }
  function suiteGlisse(e) {
    const g = glisse.current; if (!g || !panneau.current) return;
    g.dy = Math.max(0, e.touches[0].clientY - g.y0);
    if (g.dy > 0 && defile.current && defile.current.scrollTop <= 0) {
      panneau.current.style.transition = 'none';
      panneau.current.style.transform = `translateY(${g.dy}px)`;
    }
  }
  function finGlisse() {
    const g = glisse.current; glisse.current = null; if (!g || !panneau.current) return;
    const vitesse = g.dy / Math.max(1, Date.now() - g.t0);
    panneau.current.style.transition = '';
    if (g.dy > 110 || (g.dy > 40 && vitesse > 0.6)) { vibrer(8); annuler(); } else panneau.current.style.transform = '';
  }

  // Échap ferme, le fond de page ne défile plus derrière la feuille — même geste que la vue agrandie
  // du suivi (CarteSuivi.jsx), pour que la fermeture s'apprenne une seule fois. Le hook ajoute
  // ce qui manquait : le focus reste DANS la feuille tant qu'elle est ouverte, et revient au plat
  // qu'on venait d'ouvrir quand elle se ferme. La séparation en effets distincts — dont la raison
  // était notée ici — est reprise telle quelle dans le hook.
  useDialogue(racine, annuler);

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

  // « Toutes les crudités » (fondateur, 2026-09-30) : la plupart des clients prennent tout, et cocher dix cases une à
  // une est le geste le plus long de la commande d'un kebab ou d'un sandwich. Proposé EN PREMIER dans tout groupe
  // à choix multiple de crudités, sans limite de choix plus petite que la liste. Côté serveur rien ne change : ce
  // sont les mêmes options cochées, le commerce lit la liste complète sur son ticket.
  function toutesCrudites(g) {
    return g.type === 'multiple' && g.items.length > 1 && /crudit|rauwkost|raw veg/i.test(g.name || '')
      && (!g.maxSelections || g.maxSelections >= g.items.length);
  }
  function basculerTout(g) {
    setSelections((prev) => {
      const tout = g.items.every((i) => prev[g.id].has(i.id));
      return { ...prev, [g.id]: tout ? new Set() : new Set(g.items.map((i) => i.id)) };
    });
  }

  let delta = 0;
  const snapshot = [];
  const optionItemIds = [];
  groups.forEach((g) => {
    // Toutes cochées (et gratuites) : une seule ligne « Toutes les crudités » dans le panier, comme sur le ticket du
    // commerce (routes/orders.js resolveOptions) ; les identifiants envoyés restent ceux de chaque crudité.
    if (toutesCrudites(g) && g.items.every((i) => selections[g.id].has(i.id) && !i.priceDelta)) {
      snapshot.push({ groupName: g.name, name: t('platSheet.allCrudites'), priceDelta: 0 });
      g.items.forEach((i) => optionItemIds.push(i.id));
      return;
    }
    g.items.forEach((i) => {
      if (selections[g.id].has(i.id)) {
        delta += i.priceDelta;
        snapshot.push({ groupName: g.name, name: i.name, priceDelta: i.priceDelta });
        optionItemIds.push(i.id);
      }
    });
  });
  const prixUnite = +(item.price + delta).toFixed(2);
  const remise = prixRemise(item);
  // Total affiché = ce que le panier comptera : la remise du plat (Avantage Fairide, promo) s'applique au prix de base,
  // pas aux suppléments (même règle que CartContext.totals et le serveur).
  const total = +((prixUnite - (remise !== null ? Math.max(0, item.price - remise) : 0)) * qty).toFixed(2);
  const manquants = groups.filter((g) => g.required && selections[g.id].size === 0);
  const bloque = manquants.length > 0;

  return createPortal(
    <div className={`plat-feuille${ferme ? ' plat-feuille--ferme' : ''}`} role="dialog" aria-modal="true" aria-label={item.name} ref={racine} tabIndex={-1}>
      {/* Le panneau : plein écran sur téléphone, encadré et centré au-dessus de la page sur
          ordinateur (voir styles.css). Sans lui, la fiche s'étalait sur 1400px pour un plat. */}
      <div className="plat-panneau" ref={panneau} onTouchStart={debutGlisse} onTouchMove={suiteGlisse} onTouchEnd={finGlisse} onTouchCancel={finGlisse}>
      {/* Poignée : sur téléphone, elle dit qu'on peut tirer la fiche vers le bas pour la fermer. */}
      <span className="plat-poignee" aria-hidden="true" />
      <div className="plat-defile" ref={defile}>
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
          onClick={annuler}
          aria-label={t('common.close')}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="plat-corps">
          <h2 className="plat-nom">{item.name}</h2>
          {/* Prix remisé (Avantage Fairide, promo du plat) comme sur la carte, puis les allergènes déclarés (A1) :
              c'est ici, avant l'ajout, que le client les lit en entier. */}
          <div className="plat-prix-ligne">
            {remise !== null && remise < item.price
              ? <><span className="plat-prix est-remise">{euros(remise)}</span><s className="plat-prix-avant">{euros(item.price)}</s></>
              : <span className="plat-prix">{euros(item.price)}</span>}
          </div>
          {item.desc && <p className="plat-desc">{item.desc}</p>}
          {item.allergens?.length > 0 && <p className="small plat-allergenes">{t('conformite.allergensLine', { list: libellesAllergenes(item.allergens, t).join(', ') })}</p>}
          {!item.allergens?.length && item.allergensDeclaredNone && <p className="small plat-allergenes">{t('conformite.allergensNone')}</p>}

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
                {toutesCrudites(g) && (
                  <label className="plat-option plat-option--tout">
                    <span className="plat-option-gauche">
                      <input type="checkbox" checked={g.items.every((i) => choisis.has(i.id))} onChange={() => basculerTout(g)} />
                      <span>{t('platSheet.allCrudites')}</span>
                    </span>
                  </label>
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
                      {i.priceDelta !== 0 && <span className="plat-option-prix">{i.priceDelta > 0 ? '+' : ''}{euros(i.priceDelta)}</span>}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="field plat-note" style={{ padding: '0 16px' }}>
        <label htmlFor="plat-note" className="small" style={{ fontWeight: 700 }}>{t('platSheet.noteLabel')}</label>
        <input id="plat-note" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('platSheet.notePlaceholder')} />
      </div>

      {/* L'action reste collée en bas : c'est elle qui rend le défilement unique possible. */}
      <div className="plat-pied">
        {/* Pourquoi on ne peut pas ajouter — DANS le pied, au-dessus du bouton. Placée après, elle
            serait tombée sous la barre collante, donc hors de l'écran : un bouton grisé sans la
            moindre explication, exactement ce qu'on cherchait à éviter. */}
        {bloque && <p className="plat-bloque">{t('platSheet.chooseRequired', { groupe: manquants[0].name })}</p>}
        <div className="plat-quantite" role="group" aria-label={t('platSheet.quantity')}>
          <button type="button" onClick={() => { vibrer(6); setQty((q) => Math.max(1, q - 1)); }} disabled={qty <= 1} aria-label={t('platSheet.less')}>−</button>
          <span aria-live="polite" key={qty} className="plat-quantite-chiffre">{qty}</span>
          <button type="button" onClick={() => { vibrer(6); setQty((q) => Math.min(99, q + 1)); }} disabled={qty >= 99} aria-label={t('platSheet.more')}>+</button>
        </div>
        <button
          type="button"
          className="btn-gold plat-ajouter"
          ref={boutonAjouter}
          disabled={bloque || ferme}
          onClick={() => {
            // Le plat s'envole vers le panier pendant que la fiche redescend : on voit où il est parti.
            vibrer(14);
            envolerVersPanier({ depuis: boutonAjouter.current?.getBoundingClientRect(), image: imageUrl, quantite: qty });
            fermer(() => onConfirm(optionItemIds, snapshot, prixUnite, qty, note.trim()));
          }}
        >
          {/* Le libellé annonce la quantité ET le prix : on sait ce qu'on ajoute sans remonter. */}
          {t('platSheet.add', { n: qty })} · {euros(total)}
        </button>
      </div>
      </div>
    </div>,
    document.body
  );
}
