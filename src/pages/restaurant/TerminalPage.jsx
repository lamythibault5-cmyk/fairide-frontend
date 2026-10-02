import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import { dansTerminal, infosAppareil, etatImprimante, terminalAssocie, transmettreJeton, oublierJeton } from '../../terminalBridge';
import '../../terminal.css';
import { serviceGoodcomDisponible, imprimerSurGoodcom } from '../../goodcomWebPrinter';
import { abonnerTerminalNavigateur, associerTerminalNavigateur, deconnecterTerminalNavigateur } from '../../terminalNavigateur';

// Ticket de test fabriqué ici, sans passer par le serveur : il vérifie seulement le canal page → service Goodcom →
// imprimante (installation). Le test « complet », par la file d'impression, reste le bouton plus bas.
function ticketTestLocal(t, nom) {
  const x = (text, st = {}) => ({ t: 'text', text, align: st.align || 'center', size: st.size || 1, bold: !!st.bold, inverse: !!st.inverse });
  return [x('fairide.be', { bold: true }), x(nom || ''), { t: 'rule', char: '-' }, x(t('terminal.webTestTitle'), { size: 2, bold: true, inverse: true }),
    x('é è à ç ô ü € — ÉÈÀÇ'), x(new Date().toLocaleString()), { t: 'rule', char: '-' }, { t: 'feed', lines: 3 }];
}

// Terminal Fairide & impression (restaurateur) : les terminaux du commerce et leur état, l'association de CE terminal
// (quand la page tourne dans la coque Android), le moment d'impression et le nombre de copies, et le ticket de test
// qui sert à l'installation chez le restaurateur.
const TRIGGERS = ['reception', 'acceptation', 'manuel'];

export default function TerminalPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { restoId } = useOutletContext();
  const [donnees, setDonnees] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  // Reprise d'un terminal relié à un autre compte : confirmée avant d'agir (l'autre compte perd ce terminal).
  const [reprise, setReprise] = useState(false);
  const [ici, setIci] = useState(() => ({ terminal: dansTerminal(), associe: terminalAssocie(), imprimante: etatImprimante() }));
  // Goodcom utilisé depuis le navigateur (sans coque Android) : service d'impression détecté ? appareil associé ?
  const [goodcom, setGoodcom] = useState(null); // null = test en cours, true / false
  const [web, setWeb] = useState(null);
  const detecter = useCallback(() => { setGoodcom(null); serviceGoodcomDisponible({ forcer: true }).then(setGoodcom); }, []);
  useEffect(() => { if (!dansTerminal()) detecter(); }, [detecter]);
  useEffect(() => abonnerTerminalNavigateur(setWeb), []);

  const charger = useCallback(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}/terminals`, { token }).then(setDonnees).catch((e) => toast(e.message, 'erreur'));
  }, [restoId, token, toast]);
  useEffect(() => { charger(); }, [charger]);
  // L'état des terminaux (batterie, papier) change : on le relit toutes les 30 s tant que la page est ouverte.
  useEffect(() => { const i = setInterval(charger, 30000); return () => clearInterval(i); }, [charger]);

  const actifs = (donnees?.terminals || []).filter((x) => !x.revokedAt);
  const reglages = donnees?.settings || { printTrigger: 'reception', printCopies: 1 };

  async function enregistrer(patch) {
    setBusy(true);
    try {
      const s = await api(`/restaurants/${restoId}/print-settings`, { method: 'PATCH', token, body: patch });
      setDonnees((d) => ({ ...d, settings: s }));
      toast(t('terminal.saved'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }

  async function associerCeTerminal() {
    setBusy(true);
    try {
      const info = infosAppareil() || {};
      // Le numéro de série suffit au serveur pour remplacer l'ancienne ligne de CET appareil dans ce commerce ; le
      // nouveau jeton remplace l'ancien dans la coque, quel que soit le compte auquel il était relié.
      const r = await api(`/restaurants/${restoId}/terminals`, { method: 'POST', token, body: { ...info, label: info.model ? `${info.model}` : undefined } });
      if (!transmettreJeton(r.token, API_BASE)) throw new Error(t('terminal.bridgeError'));
      setIci({ terminal: true, associe: true, imprimante: etatImprimante() });
      toast(t('terminal.paired'));
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true);
    try {
      await api(`/restaurants/${restoId}/print-test`, { method: 'POST', token });
      toast(actifs.length ? t('terminal.testSent') : t('terminal.testNoTerminal'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }

  async function retirer() {
    const x = aRetirer;
    try {
      await api(`/restaurants/${restoId}/terminals/${x.id}`, { method: 'DELETE', token });
      setARetirer(null);
      toast(t('terminal.removed'));
      charger();
    } catch (e) { toast(e.message, 'erreur'); }
  }

  async function testDirect() {
    setBusy(true);
    try { await imprimerSurGoodcom(ticketTestLocal(t, donnees?.terminals?.[0]?.restaurantName || ''), 32); toast(t('terminal.webDirectOk')); }
    catch (e) { toast(t('terminal.webDirectFail', { reason: t(`terminal.printer_${e.code || 'unknown'}`) }), 'erreur'); }
    finally { setBusy(false); }
  }
  // UN TERMINAL SUIT LE COMPTE QUI S'Y CONNECTE (fondateur, 2026-10-03). Si l'appareil est déjà relié à un autre compte,
  // on envoie le jeton qu'il détient : le serveur retire l'ancienne association et crée celle de ce compte.
  async function associerNavigateur() {
    setBusy(true); setReprise(false);
    try {
      const r = await api(`/restaurants/${restoId}/terminals`, { method: 'POST', token, body: { label: t('terminal.webLabel'), model: 'Goodcom GT81H', appVersion: 'web-1', paperColumns: 32, previousToken: web?.config?.token } });
      associerTerminalNavigateur({ token: r.token, terminalId: r.terminal.id, restaurantId: restoId, restaurantName: r.restaurant?.name || '' });
      toast(t(r.takenOver ? 'terminal.webTakenOver' : 'terminal.webPaired'));
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  // Déconnexion : le terminal se retire lui-même (son jeton suffit), même s'il était relié à un autre compte.
  async function dissocierNavigateur() {
    setBusy(true);
    try {
      await deconnecterTerminalNavigateur();
      toast(t('terminal.webUnpaired'));
      charger();
    } finally { setBusy(false); }
  }
  function deconnecterCoque() {
    oublierJeton();
    setIci({ terminal: true, associe: terminalAssocie(), imprimante: etatImprimante() });
    toast(t('terminal.webUnpaired'));
    charger();
  }
  // L'appareil est-il relié à CE compte, ou à un autre ?
  const relieIci = !!web?.config && String(web.config.restaurantId) === String(restoId);
  const relieAilleurs = !!web?.config && !relieIci;

  const quand = (d) => (d ? new Date(d).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('terminal.title')}</h2>
      <p className="small" style={{ marginTop: 0, maxWidth: 680 }}>{t('terminal.intro')}</p>

      {ici.terminal && (
        <div className="card" style={{ borderLeft: '4px solid var(--iris)' }}>
          <b>{t('terminal.thisDevice')}</b>
          <p className="small" style={{ margin: '4px 0 10px' }}>
            {ici.associe ? t('terminal.thisDevicePaired') : t('terminal.thisDeviceNotPaired')}
            {ici.imprimante ? ` · ${t('terminal.printerLabel')} : ${t(`terminal.printer_${ici.imprimante}`)}` : ''}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-teal" disabled={busy || !restoId} onClick={associerCeTerminal}>{ici.associe ? t('terminal.pairThisAgain') : t('terminal.pairThis')}</button>
            {ici.associe && <button type="button" className="btn-ghost" disabled={busy} onClick={deconnecterCoque}>{t('terminal.webUnpair')}</button>}
          </div>
          {ici.associe && <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-faint)' }}>{t('terminal.pairThisAgainHelp')}</p>}
        </div>
      )}

      {!ici.terminal && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('terminal.webTitle')}</h3>
          <p className="small" style={{ marginTop: 0, maxWidth: 680 }}>{t('terminal.webHelp')}</p>
          <p className="small" style={{ margin: '0 0 10px' }}>
            {goodcom === null ? '…' : goodcom
              ? <span className="print-etat ok">✓ {t('terminal.webDetected')}</span>
              : <span className="print-etat attente">{t('terminal.webNotDetected')}</span>}
            {goodcom === false && <button type="button" className="btn-ghost" onClick={detecter}>{t('terminal.webRetry')}</button>}
          </p>
          {/* Le terminal s'est arrêté tout seul : on dit pourquoi. */}
          {!web?.config && web?.motif && <p className="small terminal-arrete" role="status">{t(`terminal.stopped_${['ACCOUNT_DELETED', 'TERMINAL_UNKNOWN', 'TERMINAL_REVOKED'].includes(web.motif) ? web.motif : 'TERMINAL_REVOKED'}`)}</p>}
          {relieAilleurs && (
            <p className="small terminal-arrete" role="status">
              {t('terminal.webOtherAccount', { name: web.config.restaurantName || (web.config.simulation ? t('terminal.webOtherSimulation') : t('terminal.webOtherUnknown')) })}
            </p>
          )}
          {relieIci ? (
            <>
              <p className="small" style={{ margin: '0 0 10px' }}>
                <span className={`print-etat ${web.imprimante === 'ok' ? 'ok' : 'attente'}`}>{t('terminal.webActive')}</span>
                {' '}{t('terminal.printerLabel')} : {t(`terminal.printer_${web.imprimante || 'unknown'}`)}
                {web.dernierTicket ? ` · ${t('terminal.webLastTicket', { date: quand(web.dernierTicket) })}` : ''}
                {web.derniereErreur ? ` · ⚠ ${t(`terminal.printer_${web.derniereErreur}`)}` : ''}
              </p>
              <p className="small" style={{ margin: '0 0 10px', color: 'var(--ink-faint)' }}>{t('terminal.webLimit')}</p>
            </>
          ) : null}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {goodcom && <button type="button" className="btn-outline" disabled={busy} onClick={testDirect}>{t('terminal.webDirectTest')}</button>}
            {goodcom && !web?.config && <button type="button" className="btn-teal" disabled={busy || !restoId} onClick={associerNavigateur}>{t('terminal.webPair')}</button>}
            {relieAilleurs && <button type="button" className="btn-teal" disabled={busy || !restoId} onClick={() => setReprise(true)}>{t('terminal.webTakeover')}</button>}
            {web?.config && <button type="button" className="btn-ghost" disabled={busy} onClick={dissocierNavigateur}>{t('terminal.webUnpair')}</button>}
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('terminal.devicesTitle')}</h3>
        {!donnees && <p className="small">…</p>}
        {donnees && actifs.length === 0 && <p className="small" style={{ margin: 0 }}>{t('terminal.noDevice')}</p>}
        <div className="terminal-liste">
          {actifs.map((x) => (
            <div key={x.id} className="terminal-ligne">
              <div>
                <b>{x.label}</b>{x.simulated && <span className="pill" style={{ marginLeft: 6 }}>{t('terminal.simulated')}</span>}
                <div className="puces">
                  <span className={`print-etat ${x.online ? 'ok' : 'erreur'}`}>{x.online ? t('terminal.online') : t('terminal.offline')}</span>
                  {x.printerStatus && <span className={`print-etat ${x.printerStatus === 'ok' ? 'ok' : 'attente'}`}>{t('terminal.printerLabel')} : {t(`terminal.printer_${x.printerStatus}`)}</span>}
                  {x.batteryLevel != null && <span className="print-etat attente">{t('terminal.battery', { n: x.batteryLevel })}{x.charging ? ' ⚡' : ''}</span>}
                </div>
                <div className="small" style={{ marginTop: 4, color: 'var(--ink-faint)' }}>
                  {t('terminal.lastSeen', { date: quand(x.lastSeenAt) })}{x.appVersion ? ` · ${t('terminal.appVersion', { v: x.appVersion })}` : ''}
                </div>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setARetirer(x)}>{t('terminal.remove')}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('terminal.whenTitle')}</h3>
        <div className="terminal-choix" role="radiogroup" aria-label={t('terminal.whenTitle')}>
          {TRIGGERS.map((k) => (
            <label key={k} className={reglages.printTrigger === k ? 'est-actif' : ''}>
              <input type="radio" name="print-trigger" checked={reglages.printTrigger === k} disabled={busy} onChange={() => enregistrer({ printTrigger: k })} />
              <span><b>{t(`terminal.trigger_${k}`)}</b><span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t(`terminal.trigger_${k}_help`)}</span></span>
            </label>
          ))}
        </div>
        <h3>{t('terminal.copiesTitle')}</h3>
        <p className="small" style={{ marginTop: 0 }}>{t('terminal.copiesHelp')}</p>
        <div className="row" style={{ gap: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={reglages.printCopies === n ? 'btn-teal' : 'btn-outline'} disabled={busy} onClick={() => enregistrer({ printCopies: n })}>
              {t('terminal.copies', { n })}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('terminal.testTitle')}</h3>
        <p className="small" style={{ marginTop: 0 }}>{t('terminal.testHelp')}</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-teal" disabled={busy || !restoId} onClick={test}>{t('terminal.testButton')}</button>
          <Link to="/dashboard/orders" className="btn-ghost">{t('terminal.backToOrders')}</Link>
        </div>
      </div>

      <ConfirmDialog open={reprise} title={t('terminal.webTakeover')} message={t('terminal.webTakeoverText', { name: web?.config?.restaurantName || t('terminal.webOtherUnknown') })}
        confirmLabel={t('terminal.webTakeover')} loading={busy} onCancel={() => setReprise(false)} onConfirm={associerNavigateur} />
      <ConfirmDialog open={!!aRetirer} danger title={t('terminal.removeTitle')} message={t('terminal.removeText', { name: aRetirer?.label || '' })}
        confirmLabel={t('terminal.remove')} onCancel={() => setARetirer(null)} onConfirm={retirer} />
    </div>
  );
}
