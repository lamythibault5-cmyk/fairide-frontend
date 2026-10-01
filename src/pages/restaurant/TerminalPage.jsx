import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import { dansTerminal, infosAppareil, etatImprimante, terminalAssocie, transmettreJeton } from '../../terminalBridge';
import '../../terminal.css';
import { serviceGoodcomDisponible, imprimerSurGoodcom } from '../../goodcomWebPrinter';
import { abonnerTerminalNavigateur, associerTerminalNavigateur, oublierTerminalNavigateur } from '../../terminalNavigateur';

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
  async function associerNavigateur() {
    setBusy(true);
    try {
      const r = await api(`/restaurants/${restoId}/terminals`, { method: 'POST', token, body: { label: t('terminal.webLabel'), model: 'Goodcom GT81H', appVersion: 'web-1', paperColumns: 32 } });
      associerTerminalNavigateur({ token: r.token, terminalId: r.terminal.id, restaurantId: restoId });
      toast(t('terminal.webPaired'));
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  async function dissocierNavigateur() {
    const id = web?.config?.terminalId;
    setBusy(true);
    try {
      if (id) await api(`/restaurants/${restoId}/terminals/${id}`, { method: 'DELETE', token }).catch(() => {});
      oublierTerminalNavigateur();
      toast(t('terminal.webUnpaired'));
      charger();
    } finally { setBusy(false); }
  }

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
          {!ici.associe && <button type="button" className="btn-teal" disabled={busy || !restoId} onClick={associerCeTerminal}>{t('terminal.pairThis')}</button>}
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
          {web?.config ? (
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

      <ConfirmDialog open={!!aRetirer} danger title={t('terminal.removeTitle')} message={t('terminal.removeText', { name: aRetirer?.label || '' })}
        confirmLabel={t('terminal.remove')} onCancel={() => setARetirer(null)} onConfirm={retirer} />
    </div>
  );
}
