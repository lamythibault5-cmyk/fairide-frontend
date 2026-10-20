import { useEffect, useRef, useState } from 'react';
import Icone from '../Icone';
import { experienceApp } from '../../natif';
import { mouvementReduit, vibrer } from '../../gestes';
import { VeloMarque } from './RouteVelo';
import '../../ecran-livreur.css';

/* GLISSER POUR CONFIRMER — « commande récupérée », « commande livrée », côté livreur, dans l'application seulement.
 *
 * POURQUOI. Au guidon, le téléphone est dans une poche ou un support, et un appui se fait sans regarder : un bouton
 * touché par mégarde valide une étape qu'on ne peut pas défaire. Un glissement jusqu'au bout est un geste délibéré,
 * et il remplace l'appui ET la confirmation qu'il aurait fallu sinon (plan docs/plan-ux-design-apres-onboarding.md,
 * L2). Sur le SITE, rien ne change : `children` (le bouton d'avant) est rendu tel quel.
 *
 * Le pouce suit le doigt 1:1 (Pointer Events, capture), et au lâcher on décide d'après l'élan projeté, pas
 * seulement d'après la position : un coup sec vers la droite suffit. Retour en place par le ressort, à la vitesse
 * du doigt (src/ressort.js, chargé seulement dans l'application). Rien qui note ou classe le livreur : ce n'est
 * qu'une autre façon d'appuyer.
 *
 * L'HABIT (fondateur, 2026-10-16, mockups/tous-les-ecrans.html, « Glisse le vélo ») : la piste est un bloc lime au texte
 * encre qui luit, et le pouce est le vélo de la marque, lime sur un rond iris, qui pédale sur place en attendant ; au
 * bout, une coche qui saute. Le geste et les libellés ne changent pas (ecran-livreur.css, .glisser-velo). */
export default function GlisserPourConfirmer({ libelle, onConfirmer, disabled = false, children }) {
  const natif = experienceApp();
  const piste = useRef(null);
  const pouce = useRef(null);
  const geste = useRef(null);
  const ressortMod = useRef(null);
  const [fait, setFait] = useState(false);
  const dernierContact = useRef(0); // dernier contact du doigt sur le pouce (voir activer)

  useEffect(() => {
    if (natif && !mouvementReduit()) import('../../ressort').then((m) => { ressortMod.current = m; }).catch(() => {});
  }, [natif]);
  // Une nouvelle étape (ou un échec côté serveur) remet le pouce au départ.
  useEffect(() => { if (!disabled) { setFait(false); poser(0); } }, [disabled]);
  // Si l'étape n'a pas abouti (code client faux, réseau), la carte de la course est toujours là : le pouce revient
  // au départ au bout de quelques secondes au lieu de rester bloqué sur « … ». En cas de succès, la carte disparaît.
  useEffect(() => {
    if (!fait) return undefined;
    const id = setTimeout(() => { setFait(false); poser(0); }, 2500);
    return () => clearTimeout(id);
  }, [fait]);

  if (!natif) return children;

  const course = () => (piste.current && pouce.current ? piste.current.clientWidth - pouce.current.offsetWidth - 8 : 0);
  function poser(x) {
    if (pouce.current) pouce.current.style.transform = `translateX(${x}px)`;
    if (piste.current) piste.current.style.setProperty('--avance', String(course() ? x / course() : 0));
  }

  // AIDES TECHNIQUES (audit du 19/10, CROSS-80) : TalkBack, VoiceOver, Switch Access et Voice Access « appuient » sur le
  // pouce par un clic, sans glissement ni touche Entrée : le livreur qui s'en sert ne pouvait pas confirmer le retrait.
  // Un clic confirme donc, SAUF s'il suit un contact du doigt (ou d'un stylet) sur le pouce : pour la personne qui voit
  // l'écran, seul le glissement valide, et un appui par mégarde ne fait que ramener le pouce au départ. Le clavier
  // (Entrée, Espace) passe aussi par ce clic.
  function noterContact(e) { if (e.pointerType === 'touch' || e.pointerType === 'pen') dernierContact.current = Date.now(); }
  function activer() {
    if (disabled || fait || Date.now() - dernierContact.current < 1000) return;
    setFait(true);
    vibrer([10, 30, 10]);
    poser(course());
    onConfirmer();
  }

  function debut(e) {
    noterContact(e);
    if (disabled || fait) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    geste.current = { x0: e.clientX, x: 0, suivi: ressortMod.current?.suiviVitesse() };
    geste.current.suivi?.ajouter(e.clientX);
  }
  function suite(e) {
    const g = geste.current; if (!g) return;
    g.x = Math.max(0, Math.min(course(), e.clientX - g.x0));
    g.suivi?.ajouter(e.clientX);
    poser(g.x);
  }
  function finir(e) {
    noterContact(e);
    const g = geste.current; geste.current = null; if (!g) return;
    const m = ressortMod.current;
    const v = g.suivi ? g.suivi.vitesse() : 0;
    const max = course();
    const valide = g.x + (m ? m.projeter(v) : 0) >= max * 0.9;
    if (valide) {
      setFait(true);
      vibrer([10, 30, 10]);
      poser(max);
      onConfirmer();
      return;
    }
    if (m) m.ressort({ de: g.x, vers: 0, vitesse: v, amortissement: 0.85, reponse: 0.3, surImage: poser });
    else poser(0);
  }

  return (
    <div ref={piste} className={`glisser-confirmer glisser-velo${fait ? ' est-fait' : ''}${disabled ? ' est-inactif' : ''}`} role="group" aria-label={libelle}>
      <span className="glisser-confirmer-texte">{fait ? '…' : libelle}</span>
      {/* Le pouce est aussi un vrai bouton : au clavier, au lecteur d'écran ou à l'accès par contacteur, l'activer confirme
          sans glisser (activer, plus haut). */}
      <button type="button" ref={pouce} className="glisser-confirmer-pouce" aria-label={libelle} disabled={disabled || fait}
        onPointerDown={debut} onPointerMove={suite} onPointerUp={finir} onPointerCancel={finir} onClick={activer}>
        {fait ? <Icone nom="valider" taille={24} /> : <VeloMarque largeur={32} />}
      </button>
    </div>
  );
}
