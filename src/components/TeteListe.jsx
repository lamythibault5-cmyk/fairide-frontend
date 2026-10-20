import { useEffect, useLayoutEffect, useRef } from 'react';
import Icone from './Icone';
import { experienceApp } from '../natif';
import { defilement } from '../gestes';
import { useEnteteDefilement } from '../hooks/useEnteteDefilement';

/* LE HAUT DE LA LISTE DES COMMERCES (fondateur, 2026-10-16, proposition A de « Le haut de la liste des commerces »,
 * mockups/tous-les-ecrans.html). Deux étages, collés en haut de l'écran :
 *
 *   1. LE BANDEAU IRIS, avec l'adresse de livraison (le bouton « Livrer à » d'avant, mêmes libellés, même carnet
 *      d'adresses) et, dessous, la route en pointillés où roule le vélo de la marque pendant qu'on fait défiler la page.
 *      Le bas du bandeau est la lèvre de la feuille blanche, comme sur les écrans de bienvenue et le suivi de commande.
 *   2. LA BANDE DES CUISINES. La cuisine choisie est sous une LENTILLE qui glisse d'une pastille à l'autre. Dans l'app,
 *      la bande est du verre de la barre d'onglets, la lentille grossit à l'appui et suit le doigt (lentillePuces.js,
 *      chargé à part) ; sur le site, bande blanche à filet et pastille iris pleine, sans geste (règle 2 de l'identité).
 *
 * En descendant, le bandeau s'efface et la bande des cuisines reste seule en haut ; en remontant, il revient
 * (useEnteteDefilement : un seuil et une marge, pas de clignotement). Pas de barre de recherche : elle a son onglet.
 *
 * Sans compte (pas d'adresse à montrer), pas de bandeau : la bande seule, collée sous la barre d'app dans l'app, et
 * dans le fil de la page sur le site public (son en-tête collant passerait par-dessus).
 *
 * Bio, Vegan, Halal et Sans gluten restent au bout de la bande, après un trait : ce sont des bascules cumulables, pas
 * un choix de cuisine — la lentille ne s'y pose pas, elles s'allument en iris. */
const VELO = (
  <svg viewBox="-3 5 82 42" width="30" height="15" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
    <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
  </svg>
);

/* La route en pointillés et le vélo lime, immobile : le bandeau de la page Recherche du site (SearchPage.jsx) la reprend,
 * comme la maquette (mockups/site-ordinateur.html, « Le cadre »). Mêmes classes que la route du bandeau ci-dessous. */
export function RouteVelo({ position = 12, className = '' }) {
  return (
    <div className={`lt-route${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="lt-velo" style={{ left: `${position}%` }}>{VELO}</span>
    </div>
  );
}

/* `mode` (site seulement, connecté, à partir de 900 px) : Livraison / À emporter à droite de l'adresse, sur le bandeau.
 * C'est le filtre « À emporter » qui existait déjà (RestaurantList.jsx, `emporter`) : « À emporter » ne garde que les
 * commerces qui proposent l'emporter, « Livraison » les montre tous, comme la pastille éteinte d'avant. Même état, même
 * logique : seule la place change. Forme : { emporter, choisir(bool), libelleLivraison, libelleEmporter, libelleGroupe }. */
export default function TeteListe({ adresse, intituleAdresse, libelleChanger, onAdresse, options, estActive, surPuce, cuisine, choisirCuisine, libelleBande, mode = null }) {
  const app = experienceApp();
  const bandeau = adresse != null;
  // Collée en haut quand on est connecté (coquille à onglets) ou dans l'app ; dans le fil de la page sur le site public.
  const collante = bandeau || app;
  const replie = useEnteteDefilement({ seuil: 60, marge: 6 }) && bandeau;

  const tete = useRef(null);
  const bande = useRef(null);
  const defile = useRef(null);
  const piste = useRef(null);
  const lentille = useRef(null);
  const velo = useRef(null);
  const choisirRef = useRef(choisirCuisine);
  const placerRef = useRef(null);
  useEffect(() => { choisirRef.current = choisirCuisine; }, [choisirCuisine]);

  // Sans compte dans l'app : la bande se colle SOUS la barre d'app (elle-même collée en haut), pas derrière.
  useLayoutEffect(() => {
    const barre = document.querySelector('.appli-barre');
    if (tete.current) tete.current.style.setProperty('--lt-dessus', barre && !bandeau ? `${barre.offsetHeight}px` : '0px');
  }, [bandeau]);

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
        // La goutte : la lentille s'étire en partant (app seulement, voir ecran-liste.css), et la pastille vient à l'écran.
        l.classList.remove('lt-lentille--etire');
        void l.offsetWidth;
        l.classList.add('lt-lentille--etire');
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

  // LE VÉLO ROULE QUAND ON DÉFILE : sa place sur la route suit la page (8 % en haut, 88 % après ~1 400 px), et il pédale
  // tant que ça bouge. Une écriture de style par image (requestAnimationFrame), aucun rendu React.
  // Par `transform` depuis sa place de départ (left: 8 %, ecran-liste.css), en pixels de la route mesurée une fois puis à
  // chaque changement de taille (2026-10-20, test de l'app Android) : `left` refaisait la mise en page à chaque image.
  useEffect(() => {
    if (!bandeau || !velo.current) return undefined;
    let attente = false;
    let arret = null;
    const route = velo.current.parentElement;
    let largeur = route ? route.clientWidth : 0;
    const poser = () => {
      attente = false;
      const y = Math.max(0, window.scrollY);
      if (velo.current) velo.current.style.transform = `translateX(${Math.round(((Math.min(88, 8 + y / 18) - 8) / 100) * largeur)}px)`;
    };
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
    return () => { window.removeEventListener('scroll', surDefilement); clearTimeout(arret); mesure?.disconnect(); };
  }, [bandeau]);

  const premiereBascule = options.findIndex((o) => o.regime);
  return (
    <div
      ref={tete}
      className={`liste-tete${collante ? ' liste-tete--collante' : ''}${bandeau ? ' liste-tete--bandeau' : ''}${replie ? ' liste-tete--replie' : ''}`}
    >
      {bandeau && (
        <div className={`lt-bandeau${mode ? ' lt-bandeau--mode' : ''}`}>
          {/* aria-label : le mot « Modifier » a quitté l'écran au profit d'un chevron (capture du fondateur, 2026-09-17), et
              un chevron seul ne dit rien à un lecteur d'écran — le libellé porte l'action, le chevron est aria-hidden. */}
          <button type="button" className="lt-adresse" onClick={onAdresse} aria-label={libelleChanger} tabIndex={replie ? -1 : undefined}>
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
      )}
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
                  className={`lt-puce${on ? ' on' : ''}`}
                  data-cuisine={opt.regime ? undefined : opt.value}
                  data-regime={opt.regime || undefined}
                  aria-pressed={on}
                  onClick={() => surPuce(opt)}
                >
                  <Icone nom={opt.emoji} taille={18} />
                  <span>{opt.label}</span>
                </button>
              ];
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
