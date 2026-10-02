import { useEffect, useState } from 'react';
import { api, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dansTerminal, infosAppareil, transmettreJeton, oublierJeton } from '../../terminalBridge';
import { abonnerTerminalNavigateur, associerTerminalNavigateur, configTerminalNavigateur, demarrerTerminalNavigateur, oublierTerminalNavigateur, traiterFile } from '../../terminalNavigateur';
import { serviceGoodcomDisponible } from '../../goodcomWebPrinter';

// Admin › Simulation › BANC D'ESSAI DES TICKETS (fondateur, 2026-10-02). But : vérifier que TOUT type de ticket de
// commande s'imprime, sur une vraie imprimante.
//   1. « Connecter cet appareil » : l'appareil que l'admin a en main devient le terminal du commerce de simulation
//      (coque Android du terminal Fairide, ou navigateur d'un Goodcom avec son service d'impression). Les tickets
//      sortent alors sur SON papier ; sans terminal, ils sortent sur l'imprimante virtuelle à côté (et « Papier »
//      les envoie à l'imprimante du navigateur).
//   2. Un bouton par type de ticket : la commande qui le produit est fabriquée dans le bac à sable (close, jamais
//      « à préparer ») et son ticket part dans la file.
//   3. Réimprimer un même ticket, en 1 à 5 exemplaires : bouton « Réimprimer » de chaque ticket du rouleau.
const TYPES = ['delivery_paid', 'delivery_driver', 'pickup_paid', 'pickup_on_site', 'scheduled', 'options_notes', 'alcohol', 'discounts', 'long', 'copies', 'driver_slip', 'cancel', 'test'];

export default function BancTickets({ pret, imprimante, onImprimante, exemplaires, onExemplaires }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [occupe, setOccupe] = useState(null);
  const [faits, setFaits] = useState(() => new Set());
  const [navigateur, setNavigateur] = useState(null); // état du terminal « navigateur » de CET appareil
  useEffect(() => abonnerTerminalNavigateur(setNavigateur), []);
  // Page rechargée alors que cet appareil est le terminal de test : il reprend sa file (le terminal « navigateur » n'est
  // démarré d'office que dans l'espace restaurateur).
  useEffect(() => { if (configTerminalNavigateur()?.simulation === true) demarrerTerminalNavigateur(); }, []);

  const reel = imprimante?.realTerminal || null;
  // Ce terminal réel est-il CET appareil ? (jeton gardé ici par le terminal « navigateur », ou coque Android.)
  const ici = !!reel && (navigateur?.config?.terminalId === reel.id || dansTerminal());

  async function connecter() {
    const coque = dansTerminal();
    // Cet appareil sert déjà de terminal à un vrai commerce : on ne lui retire pas son association.
    const deja = configTerminalNavigateur();
    if (deja && deja.simulation !== true) { toast(tr('simulation.benchAlreadyTerminal'), 'erreur'); return; }
    setOccupe('terminal');
    try {
      if (!coque && !(await serviceGoodcomDisponible({ forcer: true }))) { toast(tr('simulation.benchNoPrinter'), 'erreur'); return; }
      const infos = coque ? infosAppareil() || {} : {};
      const r = await api('/admin/simulation/terminal', {
        method: 'POST', token,
        body: { model: infos.model || (coque ? 'Terminal Fairide' : 'Goodcom (navigateur)'), serial: infos.serial, appVersion: infos.appVersion, androidVersion: infos.androidVersion, paperColumns: infos.paperColumns || 32 }
      });
      if (coque) transmettreJeton(r.token, API_BASE);
      else associerTerminalNavigateur({ token: r.token, terminalId: r.terminalId, restaurantId: r.restaurantId, simulation: true });
      onImprimante(r.printer);
      toast(tr('simulation.benchConnected'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  async function deconnecter() {
    setOccupe('terminal');
    try {
      const r = await api('/admin/simulation/terminal', { method: 'DELETE', token });
      if (dansTerminal()) oublierJeton();
      if (configTerminalNavigateur()?.simulation === true) oublierTerminalNavigateur();
      onImprimante(r);
      toast(tr('simulation.benchDisconnected'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  async function sortir(type) {
    setOccupe(type);
    try {
      const r = await api('/admin/simulation/ticket', { method: 'POST', token, body: { type } });
      onImprimante(r.printer);
      setFaits((f) => new Set(f).add(type));
      // Terminal « navigateur » sur cet appareil : on n'attend pas le prochain tour de file.
      if (ici && !dansTerminal()) traiterFile();
      toast(tr(reel ? 'simulation.benchSentToTerminal' : 'simulation.benchSentToVirtual', { ticket: tr(`simulation.tk_${type}`) }));
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  // CHOISIR QUELS TICKETS IMPRIMER (fondateur, 2026-10-02) : toucher une carte la coche ou la décoche ; « Imprimer la
  // sélection » ne sort que les tickets cochés, dans l'ordre de la grille. Rien ne part au simple toucher d'une carte.
  const [choisis, setChoisis] = useState(() => new Set());
  const basculer = (type) => setChoisis((c) => { const n = new Set(c); if (n.has(type)) n.delete(type); else n.add(type); return n; });
  async function sortirLaSelection() {
    for (const type of TYPES.filter((x) => choisis.has(x))) await sortir(type);
    setChoisis(new Set());
  }

  const heure = (d) => (d ? new Date(d).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '—');
  return (
    <div className="banc-tickets">
      <h4 style={{ margin: '0 0 4px' }}>🧪 {tr('simulation.benchTitle')}</h4>
      <p className="small" style={{ margin: '0 0 10px', maxWidth: 760 }}>{tr('simulation.benchIntro')}</p>

      <div className={`banc-terminal${reel ? (reel.online ? ' est-connecte' : ' est-hors-ligne') : ''}`}>
        <div style={{ minWidth: 0 }}>
          <b>{reel ? tr('simulation.benchTerminalOn', { label: reel.model || reel.label }) : tr('simulation.benchTerminalOff')}</b>
          <span className="small" style={{ display: 'block' }}>
            {reel
              ? tr(reel.online ? 'simulation.benchTerminalOnline' : 'simulation.benchTerminalOffline', { time: heure(reel.lastSeenAt), printer: tr(`simulation.benchPrinter_${['ok', 'paper_out', 'cover_open', 'printer_offline'].includes(reel.printerStatus) ? reel.printerStatus : 'unknown'}`) })
              : tr('simulation.benchTerminalHelp')}
          </span>
          {reel && !ici && <span className="small" style={{ display: 'block' }}>{tr('simulation.benchOtherDevice')}</span>}
          {(imprimante?.pending > 0 || imprimante?.lastError) && (
            <span className="small banc-attente">
              {imprimante.pending > 0 && tr('simulation.benchPending', { n: imprimante.pending })}
              {imprimante.lastError && ` ${tr('simulation.benchLastError', { code: imprimante.lastError })}`}
            </span>
          )}
        </div>
        {reel
          ? <button type="button" className="btn-outline" disabled={!!occupe} onClick={deconnecter}>{tr('simulation.benchDisconnect')}</button>
          : <button type="button" className="btn-teal" disabled={!!occupe || !pret} onClick={connecter}>{occupe === 'terminal' ? '…' : tr('simulation.benchConnect')}</button>}
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 8px' }}>
        <b className="small">{tr('simulation.benchPickTitle')}</b>
        <button type="button" className="btn-ghost simu-mini" disabled={!!occupe || choisis.size === TYPES.length} onClick={() => setChoisis(new Set(TYPES))}>{tr('simulation.benchSelectAll')}</button>
        <button type="button" className="btn-ghost simu-mini" disabled={!!occupe || choisis.size === 0} onClick={() => setChoisis(new Set())}>{tr('simulation.benchSelectNone')}</button>
      </div>
      <div className="banc-types" role="group" aria-label={tr('simulation.benchPickTitle')}>
        {TYPES.map((type) => {
          const coche = choisis.has(type);
          return (
            <button key={type} type="button" role="checkbox" aria-checked={coche}
              className={`banc-type${coche ? ' est-choisi' : ''}${occupe === type ? ' est-en-cours' : ''}`} disabled={!!occupe || !pret} onClick={() => basculer(type)}>
              <span className="banc-type-tete">
                <span className="banc-case" aria-hidden="true">{coche ? '✓' : ''}</span>
                <b>{tr(`simulation.tk_${type}`)}</b>
              </span>
              <span className="small">{tr(`simulation.tk_${type}_d`)}</span>
              {faits.has(type) && <span className="banc-imprime">{tr('simulation.benchPrinted')}</span>}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <button type="button" className="btn-gold" disabled={!!occupe || !pret || choisis.size === 0} onClick={sortirLaSelection}>
          {occupe && occupe !== 'terminal' ? tr('simulation.benchPrinting', { ticket: tr(`simulation.tk_${occupe}`) }) : tr('simulation.benchPrintSelected', { n: choisis.size })}
        </button>
        <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {tr('simulation.benchReprintCopies')}
          <span className="exemplaires">
            <button type="button" className="btn-ghost" aria-label="−" disabled={exemplaires <= 1} onClick={() => onExemplaires(Math.max(1, exemplaires - 1))}>−</button>
            <b>{exemplaires}</b>
            <button type="button" className="btn-ghost" aria-label="+" disabled={exemplaires >= 5} onClick={() => onExemplaires(Math.min(5, exemplaires + 1))}>+</button>
          </span>
        </span>
      </div>
      <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-faint)' }}>{tr('simulation.benchReprintHelp')}</p>
    </div>
  );
}
