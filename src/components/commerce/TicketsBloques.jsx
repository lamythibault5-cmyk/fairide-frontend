import { useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { playChime } from '../../hooks/useNewOrderAlert';

/* TICKETS QUI NE SORTENT PAS, DITS EN TÊTE DE COMMANDES (chasse aux bugs avant GO, G62 et G67, 2026-11-06).
 *
 * Un ticket bloqué ne se voyait qu'à une petite étiquette sur chaque carte : le soir où le rouleau était vide ou la page du
 * terminal fermée, la cuisine qui travaille au papier ratait les commandes acceptées sur un autre appareil. Ici, pour les
 * commandes en cours (o.print, backend impressions.resumeImpressions) :
 *   - terminal hors ligne et tickets en attente : « rallume-le ou rouvre sa page » (ils sortiront à son retour ; le serveur
 *     prévient aussi le commerce et l'équipe, backend alerteTerminal.js) ;
 *   - tickets en attente après un incident (papier, capot, refus de l'imprimante) : ils repartent d'eux-mêmes, « vérifie le
 *     papier » ;
 *   - tickets abandonnés (status failed) : UN bouton « Réimprimer » pour tous. Pas pour les deux cas précédents : il les
 *     doublerait au retour du terminal.
 * Un carillon grave, une fois, quand le nombre monte. */
function bloquee(o, enLigne) {
  const p = o.print;
  if (!p) return null;
  if (p.pending > 0 && !enLigne) return 'horsLigne';
  if (p.pending > 0 && p.lastError) return 'incident';
  if (p.failed > 0 && !p.pending) return 'abandon';
  return null;
}

export default function TicketsBloques({ commandes, aTerminal, terminalEnLigne, onReimprimer, envoi }) {
  const { t } = useLanguage();
  const liste = aTerminal ? commandes.map((o) => ({ o, cas: bloquee(o, terminalEnLigne) })).filter((x) => x.cas) : [];
  const n = liste.length;
  const avant = useRef(0);
  useEffect(() => {
    if (n > avant.current) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        playChime(ctx, [659.25, 523.25, 440]);
        setTimeout(() => ctx.close().catch(() => {}), 1500);
      } catch { /* son bloqué par le navigateur : la carte reste */ }
    }
    avant.current = n;
  }, [n]);
  if (!n) return null;
  const abandons = liste.filter((x) => x.cas === 'abandon').map((x) => x.o);
  const aide = liste.some((x) => x.cas === 'horsLigne') ? t('ordersResto.ticketsTerminalMuet') : t('ordersResto.ticketsVerifier');
  return (
    <div className="ec-alerte" role="alert">
      <b>{n === 1 ? t('ordersResto.ticketsBloquesUn') : t('ordersResto.ticketsBloques', { n })}</b>
      <p>{aide}</p>
      {abandons.length > 0 && (
        <p><button type="button" className="btn-outline btn-sm" disabled={envoi} onClick={() => onReimprimer(abandons)}>{t('ordersResto.ticketsReimprimer')}</button></p>
      )}
    </div>
  );
}
