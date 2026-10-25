import { useEffect, useLayoutEffect, useRef } from 'react';
import Icone from './Icone';
import { experienceApp } from '../natif';
import { defilement } from '../gestes';
import { illustrationCuisine } from '../menuCategories';

/* LE HAUT DE LA LISTE DES COMMERCES (fondateur, 2026-10-16, proposition A de « Le haut de la liste des commerces »,
 * maquettes/tous-les-ecrans/tous-les-ecrans.html). Deux étages :
 *
 *   1. LE BANDEAU IRIS, collé en haut de l'écran, avec l'adresse de livraison (le bouton « Livrer à » d'avant, mêmes
 *      libellés, même carnet d'adresses) et, dessous, la route en pointillés où roule le vélo de la marque pendant qu'on
 *      fait défiler la page. Le bas du bandeau est la lèvre de la feuille blanche, comme sur les écrans de bienvenue.
 *   2. LA BANDE DES CUISINES, COMME UBER EATS (fondateur, 2026-10-25, version A de maquettes/barre-cuisines, « le site
 *      aussi ») : plus de cadre autour, le dessin de chaque famille en 52 px avec son nom dessous, et elle PART AVEC LA
 *      PAGE quand on descend — elle n'est plus dans le bloc collé, seul le bandeau reste. La cuisine choisie est sous une
 *      LENTILLE qui glisse de l'une à l'autre : du verre dans l'app, qui grossit à l'appui et suit le doigt
 *      (lentillePuces.js, chargé à part) ; une pastille iris pleine sur le site, sans geste (règle 2 de l'identité).
 *      Dessins en 3D dans l'app, en aplat (cuisines-2d) sur le site.
 *
 * LE BANDEAU NE PART PLUS (fondateur, 2026-10-21, maquettes/bandeau-velo/bandeau-velo.html : « A, à la taille de C »). Il
 * faisait 118 px et s'effaçait dès qu'on descendait : on ne voyait jamais le vélo rouler. Il fait maintenant 88 px, la hauteur
 * de la version C dépliée, avec la version A — la maison, « Livrer à » au-dessus de l'adresse, la route dessous — et il ne se
 * replie jamais : il reste collé en haut, sur l'app comme sur le site. Pas de barre de recherche : elle a son onglet.
 *
 * Sans compte (pas d'adresse à montrer), pas de bandeau : la bande seule, dans le fil de la page.
 *
 * Bio, Vegan, Halal et Sans gluten restent au bout de la bande, après un trait : ce sont des bascules cumulables, pas
 * un choix de cuisine — la lentille ne s'y pose pas, elles s'allument en iris.
 *
 * LES FAMILLES, PUIS LEURS SPÉCIALITÉS (fondateur, 2026-10-22, version X de maquettes/categories-commerce) : la bande montre
 * les familles (specialites.js) ; une famille choisie ouvre dessous une rangée de pastilles, « Tout » puis ses spécialités
 * (`sous` : { options: [{ value, label }], valeur, choisir(v), libelleTout, libelle }). Seulement quand la famille en a au
 * moins deux chez les commerces de la liste : une seule n'apprendrait rien. */
const VELO = (
  <svg viewBox="-3 5 82 42" width="30" height="15" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
    <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
  </svg>
);

/* LE VÉLO ROULE QUAND ON DÉFILE : sa place sur la route suit la page (8 % en haut, 88 % après ~1 400 px).
 * Une écriture de style par image (requestAnimationFrame), aucun rendu React.
 * Par `transform` depuis sa place de départ (left: 8 %, ecran-liste.css), en pixels de la route mesurée une fois puis à
 * chaque changement de taille (2026-10-20, test de l'app Android) : `left` refaisait la mise en page à chaque image.
 * `avance` (en points de pourcentage) s'ajoute au défilement : la Recherche le fait avancer de 9 par lettre tapée
 * (fondateur, 2026-10-24, version A de maquettes/commandes-recherche) ; il y glisse (transition .3s).
 * Il glisse À PLAT, sans sautiller (fondateur, 2026-10-25, version A de maquettes/velo-sans-cahot) : `roule` ne sert plus
 * qu'à couper la transition pendant le défilement (ecran-liste.css). */
export function useVeloQuiRoule(velo, actif = true, avance = 0) {
  const avanceRef = useRef(avance);
  const poserRef = useRef(null);
  useEffect(() => {
    if (!actif || !velo.current) return undefined;
    let attente = false;
    let arret = null;
    const route = velo.current.parentElement;
    let largeur = route ? route.clientWidth : 0;
    // La dernière place écrite : arrivé au bout de sa route (après ~1 400 px), le vélo ne bouge plus, et réécrire la même
    // valeur à chaque image coûtait quand même une mise à jour du style (2026-10-23, app iPhone lente).
    let place = null;
    const poser = () => {
      attente = false;
      const y = Math.max(0, window.scrollY);
      const x = Math.round(((Math.min(88, 8 + y / 18 + avanceRef.current) - 8) / 100) * largeur);
      if (x === place || !velo.current) return;
      place = x;
      velo.current.style.transform = `translateX(${x}px)`;
    };
    poserRef.current = poser;
    const mesure = typeof ResizeObserver === 'undefined' || !route ? null : new ResizeObserver(() => { largeur = route.clientWidth; poser(); });
    mesure?.observe(route);
    const surDefilement = () => {
      velo.current?.classList.add('roule');
      clearTimeout(arret);
      arret = setTimeout(() => velo.current?.classList.remove('roule'), 220);
      if (attente) return;
      attente = true;
      window.requestAnimationFrame(poser);
    };
    poser();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => { window.removeEventListener('scroll', surDefilement); clearTimeout(arret); mesure?.disconnect(); poserRef.current = null; };
  }, [actif, velo]);
  // Une lettre tapée ou effacée : il glisse jusqu'à sa nouvelle place (la transition de .3s, ecran-liste.css).
  useEffect(() => {
    if (avanceRef.current === avance) return;
    avanceRef.current = avance;
    poserRef.current?.();
  }, [avance]);
}

/* La route en pointillés et le vélo lime : le bandeau de la page Recherche (SearchPage.jsx) et celui de Mes commandes sans
 * commande en cours (Orders.jsx) la reprennent. Mêmes classes que la route du bandeau ci-dessous. `roule` : il avance quand
 * on fait défiler, et de `avance` points en plus ; sinon il reste à `position`. */
export function RouteVelo({ position = 12, className = '', roule = false, avance = 0 }) {
  const velo = useRef(null);
  useVeloQuiRoule(velo, roule, avance);
  return (
    <div className={`lt-route${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="lt-velo" ref={velo} style={roule ? undefined : { left: `${position}%` }}>{VELO}</span>
    </div>
  );
}

/* `mode` (site seulement, connecté, à partir de 900 px) : Livraison / À emporter à droite de l'adresse, sur le bandeau.
 * C'est le filtre « À emporter » qui existait déjà (RestaurantList.jsx, `emporter`) : « À emporter » ne garde que les
 * commerces qui proposent l'emporter, « Livraison » les montre tous, comme la pastille éteinte d'avant. Même état, même
 * logique : seule la place change. Forme : { emporter, choisir(bool), libelleLivraison, libelleEmporter, libelleGroupe }. */
export default function TeteListe({ adresse, intituleAdresse, libelleChanger, onAdresse, options, estActive, surPuce, cuisine, choisirCuisine, libelleBande, mode = null, sous = null }) {
  const app = experienceApp();
  const bandeau = adresse != null;

  const bande = useRef(null);
  const defile = useRef(null);
  const piste = useRef(null);
  const lentille = useRef(null);
  const velo = useRef(null);
  const choisirRef = useRef(choisirCuisine);
  const placerRef = useRef(null);
  useEffect(() => { choisirRef.current = choisirCuisine; }, [choisirCuisine]);

  // LA LENTILLE SUR LA CUISINE CHOISIE. Une mesure par changement (offsetLeft / offsetWidth), puis un `transform` que la
  // transition CSS fait glisser. Première pose sans transition : pas de glissement depuis le bord gauche à l'ouverture.
  useLayoutEffect(() => {
    const p = piste.current;
    const l = lentille.current;
    if (!p || !l) return undefined;
    let precedente = null;
    const placer = () => {
      const puce = p.querySelector('.lt-puce[data-cuisine].on');
      if (!puce || !puce.offsetWidth) { l.style.opacity = '0'; return; }
      const premiere = !l.dataset.pose;
      l.dataset.x = String(puce.offsetLeft);
      l.dataset.y = String(puce.offsetTop);
      if (premiere) l.style.transition = 'none';
      l.style.opacity = '1';
      l.style.width = `${puce.offsetWidth}px`;
      l.style.height = `${puce.offsetHeight}px`;
      l.style.transform = `translate(${puce.offsetLeft}px, ${puce.offsetTop}px)`;
      if (premiere) { void l.offsetWidth; l.style.transition = ''; l.dataset.pose = '1'; }
      if (precedente && precedente !== puce) {
        // La pastille vient à l'écran. Plus de « goutte » (la lentille qui s'étirait et rebondissait en partant) : elle glisse
        // comme celle de la barre d'onglets (fondateur, 2026-10-23 : « beaucoup plus calme », ecran-liste.css).
        const d = defile.current;
        if (d) {
          const g = puce.offsetLeft - 24;
          const dr = puce.offsetLeft + puce.offsetWidth + 24;
          if (g < d.scrollLeft) d.scrollTo({ left: g, behavior: defilement() });
          else if (dr > d.scrollLeft + d.clientWidth) d.scrollTo({ left: dr - d.clientWidth, behavior: defilement() });
        }
      }
      precedente = puce;
    };
    placer();
    placerRef.current = placer;
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observateur = new ResizeObserver(() => placer());
    observateur.observe(p);
    return () => observateur.disconnect();
  }, []);
  // Une autre cuisine choisie (ou la liste des pastilles qui change) : la lentille y va.
  useLayoutEffect(() => { placerRef.current?.(); }, [cuisine, options.length]);

  // Dans l'app : le verre, la lentille qu'on promène du doigt et la réfraction (le site n'en télécharge rien).
  useEffect(() => {
    if (!app || !bande.current || !piste.current || !lentille.current) return undefined;
    let debrancher = null;
    let fini = false;
    import('../lentillePuces')
      .then(({ brancherLentillePuces }) => {
        if (!fini) debrancher = brancherLentillePuces(bande.current, piste.current, lentille.current, (v) => choisirRef.current(v));
      })
      .catch(() => {});
    return () => { fini = true; debrancher?.(); };
  }, [app]);

  // Le vélo roule quand on défile (useVeloQuiRoule, plus haut) : seulement avec le bandeau, qui porte la route.
  useVeloQuiRoule(velo, bandeau);

  const premiereBascule = options.findIndex((o) => o.regime);
  return (
    <>
      {/* Seul le bandeau est dans le bloc collé : la bande des cuisines, après lui, part avec la page. */}
      {bandeau && (
        <div className="liste-tete liste-tete--collante liste-tete--bandeau">
          <div className={`lt-bandeau${mode ? ' lt-bandeau--mode' : ''}`}>
            {/* aria-label : le mot « Modifier » a quitté l'écran au profit d'un chevron (capture du fondateur, 2026-09-17), et
                un chevron seul ne dit rien à un lecteur d'écran — le libellé porte l'action, le chevron est aria-hidden. */}
            <button type="button" className="lt-adresse" onClick={onAdresse} aria-label={libelleChanger}>
              <span className="lt-adresse-icone"><Icone nom="maison" taille={20} /></span>
              <span className="lt-adresse-texte">
                <span className="lt-adresse-intitule">{intituleAdresse}</span>
                <span className="lt-adresse-valeur">{adresse}</span>
              </span>
              <span className="lt-chevron" aria-hidden="true" />
            </button>
            {mode && (
              <div className={`lt-mode${mode.emporter ? ' lt-mode--emporter' : ''}`} role="group" aria-label={mode.libelleGroupe}>
                <span className="lt-mode-pouce" aria-hidden="true" />
                <button type="button" className={mode.emporter ? '' : 'on'} aria-pressed={!mode.emporter} onClick={() => mode.choisir(false)}>
                  <Icone nom="velo" taille={18} />{mode.libelleLivraison}
                </button>
                <button type="button" className={mode.emporter ? 'on' : ''} aria-pressed={mode.emporter} onClick={() => mode.choisir(true)}>
                  <Icone nom="sac" taille={18} />{mode.libelleEmporter}
                </button>
              </div>
            )}
            <div className="lt-route" aria-hidden="true">
              <span className="lt-velo" ref={velo}>{VELO}</span>
            </div>
          </div>
        </div>
      )}
      {/* Le dessin de chaque cuisine en 52 px au-dessus de son nom, comme Uber Eats (2026-10-25) : en couleur 3D dans l'app,
          en aplat sur le site (maquettes/site-illustrations). Bio, Vegan, Halal et Sans gluten (masqués pour le moment,
          MENTIONS_ALIMENTAIRES) n'ont pas de dessin : leur tracé dans un rond prend la même place. */}
      <div className="lt-cuisines">
        <div className="lt-puces" ref={bande}>
          {/* Les pastilles sont des <button> avec aria-pressed : joignables au clavier (voir l'historique de RestaurantList). */}
          <div className="lt-defile" ref={defile} role="group" aria-label={libelleBande}>
            <div className="lt-piste" ref={piste}>
              <span className="lt-lentille" ref={lentille} aria-hidden="true" />
              {options.map((opt, i) => {
                const on = estActive(opt);
                return [
                  i === premiereBascule && i > 0 ? <span key="trait" className="lt-trait" aria-hidden="true" /> : null,
                  <button
                    key={opt.value}
                    type="button"
                    className={`lt-puce${on ? ' on' : ''}${opt.envie ? ' lt-puce--envie' : ''}`}
                    data-cuisine={opt.regime ? undefined : opt.value}
                    data-regime={opt.regime || undefined}
                    aria-pressed={on}
                    onClick={() => surPuce(opt)}
                  >
                    {opt.illustration ? <img className="lt-illu" src={illustrationCuisine(opt.illustration, { plat: !app })} alt="" width="52" height="52" decoding="async" draggable="false" />
                      : <span className="lt-illu lt-illu--trace"><Icone nom={opt.emoji} taille={24} /></span>}
                    <span>{opt.label}</span>
                  </button>
                ];
              })}
            </div>
          </div>
        </div>
        {sous && sous.options.length > 1 && (
          <div className="lt-sous" role="group" aria-label={sous.libelle}>
            {[{ value: '', label: sous.libelleTout }, ...sous.options].map((o) => (
              <button key={o.value || '__tout'} type="button" className={`lt-sous-puce${sous.valeur === o.value ? ' on' : ''}`} aria-pressed={sous.valeur === o.value}
                onClick={() => sous.choisir(o.value)}>{o.label}</button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
