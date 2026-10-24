import { useRef, useState } from 'react';
import { api } from '../../../api';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Icone from '../../../components/Icone';
import { useLanguage } from '../../../context/LanguageContext';
import ouvrirDocument from '../../../ouvrirDocument';
import { money, fmtDateTime } from '../adminUtils';
import { useApiData, devise } from './common';

// Boîte à factures (fondateur, 2026-10-23 : « un endroit où je mets mes factures, PDF ou autre, et Claude les met dans
// la comptabilité »). Au-dessus des dépenses : déposer des fichiers, voir ce qui est arrivé (dépôt, e-mail, Peppol) et
// ce que la lecture demande de vérifier, et comptabiliser d'un clic les brouillons sans remarque. Le serveur range les
// pièces (fairide-backend, facturesRecues.js) ; elles attendent « à lire » jusqu'à la lecture de la semaine, faite par
// Claude dans Claude Code (skill fairide-factures, sans API — fondateur, 2026-10-23).

const LIGNES_VISIBLES = 6;

export default function BoiteFactures({ token, toast, onChange }) {
  const { t: tr } = useLanguage();
  const state = useApiData(() => api('/admin/accounting/pieces?limit=30', { token }), []);
  const [depot, setDepot] = useState(false);
  const [survol, setSurvol] = useState(false);
  const [releve, setReleve] = useState(false);
  const [toutVoir, setToutVoir] = useState(false);
  const [confirmLot, setConfirmLot] = useState(false);
  const [occupe, setOccupe] = useState(null); // id de la pièce en cours d'action
  const entree = useRef(null);
  const data = state.data;
  const items = data?.items || [];

  async function envoyer(fichiers) {
    const liste = Array.from(fichiers || []);
    if (!liste.length) return;
    setDepot(true);
    try {
      const form = new FormData();
      for (const f of liste) form.append('fichiers', f);
      const r = await api('/admin/accounting/pieces', { method: 'POST', token, body: form });
      const nouvelles = (r.items || []).filter((p) => !p.alreadyThere).length;
      const deja = (r.items || []).length - nouvelles;
      toast(tr('adminAccounting.inboxUploaded', { n: nouvelles }) + (deja ? ` ${tr('adminAccounting.inboxAlreadyThere', { n: deja })}` : ''));
      for (const x of r.refused || []) toast(`${x.filename} : ${x.error}`, 'erreur');
      state.reload();
    } catch (e) { toast(e.message, 'erreur'); } finally { setDepot(false); if (entree.current) entree.current.value = ''; }
  }

  async function relever() {
    setReleve(true);
    try {
      const b = await api('/admin/accounting/pieces/fetch', { method: 'POST', token });
      const n = (b.email?.traites || 0) + (b.peppol?.traites || 0);
      const erreur = b.email?.erreur || b.peppol?.erreur;
      if (erreur) toast(erreur, 'erreur');
      else toast(n ? tr('adminAccounting.inboxFetched', { n }) : tr('adminAccounting.inboxNothingNew'));
      state.reload(); onChange?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setReleve(false); }
  }

  async function comptabiliserLot() {
    setOccupe('lot');
    try {
      const r = await api('/admin/accounting/expenses/post-clean', { method: 'POST', token });
      toast(tr('adminAccounting.inboxPosted', { n: r.posted }));
      for (const x of r.refused || []) toast(x.error, 'erreur');
      state.reload(); onChange?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); setConfirmLot(false); }
  }

  async function action(piece, quoi) {
    setOccupe(piece.id);
    try {
      await api(`/admin/accounting/pieces/${piece.id}/${quoi}`, { method: 'POST', token });
      toast(quoi === 'requeue' ? tr('adminAccounting.inboxRequeued') : tr('adminAccounting.inboxIgnored'));
      state.reload(); onChange?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }

  const setup = data?.setup;
  const counts = data?.counts || {};
  const visibles = toutVoir ? items : items.slice(0, LIGNES_VISIBLES);
  const sources = { depot: tr('adminAccounting.inboxSourceUpload'), email: tr('adminAccounting.inboxSourceEmail'), peppol: 'Peppol' };
  const statuts = {
    a_lire: tr('adminAccounting.inboxStatusReading'), lue: tr('adminAccounting.inboxStatusRead'), pas_une_facture: tr('adminAccounting.inboxStatusNotInvoice'),
    doublon: tr('adminAccounting.inboxStatusDuplicate'), echec: tr('adminAccounting.inboxStatusFailed'), ignoree: tr('adminAccounting.inboxStatusIgnored')
  };

  return (
    <section className="boite-factures" aria-labelledby="boite-factures-titre">
      <div className="boite-factures-tete">
        <div>
          <h3 id="boite-factures-titre">{tr('adminAccounting.inboxTitle')}</h3>
          <p className="small">{tr('adminAccounting.inboxHelp', { adresse: setup?.adresse || 'factures@fairide.be' })}</p>
        </div>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={relever} disabled={releve}>{releve ? '...' : tr('adminAccounting.inboxFetch')}</button>
      </div>

      <label
        className={`boite-factures-depot${survol ? ' survol' : ''}${depot ? ' occupe' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => { e.preventDefault(); setSurvol(false); envoyer(e.dataTransfer.files); }}
      >
        <input ref={entree} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic" hidden disabled={depot} onChange={(e) => envoyer(e.target.files)} />
        <Icone nom="telecharger" taille={20} />
        <span><b>{depot ? tr('adminAccounting.inboxUploading') : tr('adminAccounting.inboxDrop')}</b><span className="small">{tr('adminAccounting.inboxDropHelp')}</span></span>
      </label>

      {setup && (
        <ul className="boite-factures-entrees">
          <li className="ok"><Icone nom="horloge" taille={14} />{tr('adminAccounting.inboxReaderWeekly', { n: counts.toRead || 0 })}</li>
          <li className={setup.email ? 'ok' : 'non'}><Icone nom={setup.email ? 'coche' : 'alerte'} taille={14} />{tr(setup.email ? 'adminAccounting.inboxEmailOn' : 'adminAccounting.inboxEmailOff', { adresse: setup.adresse })}</li>
          <li className={setup.peppol ? 'ok' : 'non'}><Icone nom={setup.peppol ? 'coche' : 'alerte'} taille={14} />{tr(setup.peppol ? 'adminAccounting.inboxPeppolOn' : 'adminAccounting.inboxPeppolOff')}</li>
        </ul>
      )}

      {(counts.cleanDrafts > 0 || counts.draftsToCheck > 0 || counts.failed > 0) && (
        <div className="boite-factures-bilan">
          {counts.cleanDrafts > 0 && <button type="button" className="btn-teal" onClick={() => setConfirmLot(true)} disabled={!!occupe}>{tr('adminAccounting.inboxPostClean', { n: counts.cleanDrafts })}</button>}
          {counts.draftsToCheck > 0 && <span className="small a-verifier"><Icone nom="alerte" taille={14} className="icone-texte" />{tr('adminAccounting.inboxToCheck', { n: counts.draftsToCheck })}</span>}
          {counts.failed > 0 && <span className="small a-verifier">{tr('adminAccounting.inboxFailedCount', { n: counts.failed })}</span>}
        </div>
      )}

      {state.error && !data && <p className="small" role="alert">{state.error}</p>}
      {items.length > 0 && (
        <ul className="boite-factures-liste">
          {visibles.map((p) => (
            <li key={p.id} className={`piece statut-${p.status}`}>
              <div className="piece-ligne">
                <span className="piece-source">{sources[p.source] || p.source}<span className="small">{fmtDateTime(p.receivedAt)}</span></span>
                <span className="piece-quoi">
                  <b>{p.reading?.supplier || p.filename || p.subject || '-'}</b>
                  <span className="small">{[p.reading?.invoiceNumber, p.reading && p.reading.total ? (p.reading.currency === 'EUR' ? money(p.reading.total) : devise(p.reading.total, p.reading.currency)) : null, p.source === 'email' ? p.sender : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`pill fin-status piece-${p.status}`}>{statuts[p.status] || p.status}</span>
                <span className="fin-row-actions">
                  <button type="button" className="btn-outline" onClick={() => ouvrirDocument({ lien: `/admin/accounting/pieces/${p.id}/file`, token, toast })}>{tr('adminAccounting.inboxOpen')}</button>
                  {['lue', 'echec', 'doublon', 'pas_une_facture'].includes(p.status) && !p.expenses.some((x) => x.status !== 'draft') && (
                    <button type="button" className="btn-ghost" disabled={occupe === p.id} onClick={() => action(p, 'requeue')}>{tr('adminAccounting.inboxRequeueBtn')}</button>
                  )}
                  {p.status !== 'ignoree' && !p.expenses.some((x) => x.status !== 'draft') && (
                    <button type="button" className="btn-danger-ghost" disabled={occupe === p.id} onClick={() => action(p, 'ignore')}>{tr('adminAccounting.inboxIgnoreBtn')}</button>
                  )}
                </span>
              </div>
              {p.status === 'echec' && p.error && <p className="small piece-points">{p.error}</p>}
              {p.checkPoints.length > 0 && p.status !== 'ignoree' && (
                <ul className="small piece-points">{p.checkPoints.map((c) => <li key={c}>{c}</li>)}</ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length > LIGNES_VISIBLES && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => setToutVoir((v) => !v)}>{toutVoir ? tr('adminAccounting.inboxShowLess') : tr('adminAccounting.inboxShowAll', { n: items.length })}</button>
      )}
      <ConfirmDialog open={confirmLot} title={tr('adminAccounting.inboxPostCleanTitle', { n: counts.cleanDrafts || 0 })} message={tr('adminAccounting.inboxPostCleanBody')} loading={occupe === 'lot'} onConfirm={comptabiliserLot} onCancel={() => setConfirmLot(false)} confirmLabel={tr('adminAccounting.postExpense')} />
    </section>
  );
}
