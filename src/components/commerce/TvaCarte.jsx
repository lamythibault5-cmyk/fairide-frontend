import { useCallback, useEffect, useId, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';

/* TVA de la carte et historique des prix (CODE-2 et CODE-3, décisions du 8 octobre 2026, DEC-25).
 *
 * Le taux de TVA d'un plat appartient au commerce : c'est lui qui vend et qui en répond. Fairide le PROPOSE à l'import
 * (tvaPlats.js côté serveur) ; le commerce le corrige ici, plat par plat, malgré le verrou de la carte (le serveur
 * laisse passer PATCH /menu/:id/vat et rien d'autre). Un changement de taux la fait redevenir « à signer » : c'est
 * voulu, il relit et valide ce qu'il vend.
 *
 * Trois blocs, dans cet ordre parce que c'est l'ordre d'urgence :
 *   1. un changement de taux annoncé pour tous les commerces (réforme 6 % → 12 %…) — refusable jusqu'à sa date d'effet,
 *      accepté sans réponse : on le montre en haut, ouvert, avec le formulaire de refus ;
 *   2. les taux de ses plats, repliés (on n'y touche presque jamais) ;
 *   3. l'historique des prix et des taux — qui, quand, à la demande de qui —, replié, chargé à l'ouverture.
 * Composant à part : MenuPage.jsx est un des deux fichiers à ne plus faire grossir (CLAUDE.md). */
const TAUX = [6, 12, 21, 0];

export default function TvaCarte({ restoId, token, menu = [], modeAdmin = false, toast, onChange }) {
  const [changements, setChangements] = useState([]);
  const charger = useCallback(() => {
    api(`/restaurants/${restoId}/vat-rate-changes`, { token }).then(setChangements).catch(() => setChangements([]));
  }, [restoId, token]);
  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="tva-carte">
      {changements.map((c) => <ChangementTaux key={c.id} c={c} restoId={restoId} token={token} toast={toast} onDone={setChangements} />)}
      {!modeAdmin && menu.length > 0 && <TauxDesPlats restoId={restoId} token={token} menu={menu} toast={toast} onChange={onChange} />}
      {menu.length > 0 && <HistoriquePrix restoId={restoId} token={token} />}
    </div>
  );
}

function ChangementTaux({ c, restoId, token, toast, onDone }) {
  const { t } = useLanguage();
  const id = useId();
  const [nom, setNom] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const date = new Date(c.effectiveAt).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  async function refuser(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      onDone(await api(`/restaurants/${restoId}/vat-rate-changes/${c.id}/refuse`, { method: 'POST', token, body: { name: nom, comment: commentaire } }));
      toast?.(t('tvaCarte.refusedToast'));
    } catch (err) { toast?.(err.message, 'erreur'); } finally { setEnvoi(false); }
  }
  return (
    <div className="card" role="note" style={{ marginBottom: 12 }}>
      <b>{t('tvaCarte.changeTitle', { from: c.from, to: c.to, date })}</b>
      <p className="small" style={{ margin: '6px 0' }}>{t(`tvaCarte.changeText_${c.scope}`, { n: c.items, from: c.from, to: c.to, date })}</p>
      <p className="small" style={{ margin: '0 0 8px', color: 'var(--ink-soft)' }}>{c.reason}</p>
      {c.objectedAt ? (
        <p className="small" style={{ margin: 0 }}>{t('tvaCarte.refusedOn', { date: new Date(c.objectedAt).toLocaleDateString(getLocale()), name: c.objectedBy })}</p>
      ) : (
        <form onSubmit={refuser}>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('tvaCarte.silenceIsYes', { date })}</p>
          <details>
            <summary className="small">{t('tvaCarte.refuseOpen')}</summary>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor={`${id}-nom`} className="small">{t('tvaCarte.yourName')}</label>
              <input id={`${id}-nom`} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" required minLength={3} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-com`} className="small">{t('tvaCarte.comment')}</label>
              <textarea id={`${id}-com`} rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
            </div>
            <button type="submit" className="btn-outline" disabled={envoi || nom.trim().length < 3}>{t('tvaCarte.refuseButton')}</button>
          </details>
        </form>
      )}
    </div>
  );
}

function TauxDesPlats({ restoId, token, menu, toast, onChange }) {
  const { t } = useLanguage();
  const id = useId();
  const [enCours, setEnCours] = useState(null);
  async function changer(item, vatRate) {
    setEnCours(item.id);
    try {
      await api(`/restaurants/${restoId}/menu/${item.id}/vat`, { method: 'PATCH', token, body: { vatRate } });
      toast?.(t('tvaCarte.savedToast', { name: item.name, rate: vatRate }));
      onChange?.();
    } catch (err) { toast?.(err.message, 'erreur'); } finally { setEnCours(null); }
  }
  return (
    <details className="card" style={{ marginBottom: 12 }}>
      <summary><b>{t('tvaCarte.ratesTitle')}</b></summary>
      <p className="small" style={{ margin: '6px 0 10px' }}>{t('tvaCarte.ratesHelp')}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {menu.map((item, k) => (
          <li key={item.id} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: k ? '1px solid var(--line)' : 'none' }}>
            <label htmlFor={`${id}-${item.id}`} className="small" style={{ flex: 1, minWidth: 0 }}>{item.name}</label>
            <select id={`${id}-${item.id}`} value={item.vatRate ?? ''} disabled={enCours === item.id}
              onChange={(e) => e.target.value !== '' && changer(item, Number(e.target.value))} style={{ width: 'auto' }}>
              {item.vatRate == null && <option value="">—</option>}
              {TAUX.map((r) => <option key={r} value={r}>{r} %</option>)}
            </select>
          </li>
        ))}
      </ul>
    </details>
  );
}

function HistoriquePrix({ restoId, token }) {
  const { t } = useLanguage();
  const [lignes, setLignes] = useState(null);
  const [erreur, setErreur] = useState('');
  function ouvrir(e) {
    if (!e.currentTarget.open || lignes) return;
    api(`/restaurants/${restoId}/menu-history`, { token }).then(setLignes).catch((err) => setErreur(err.message));
  }
  const valeur = (h, v) => (v == null ? '—' : h.field === 'price' ? euros(v) : `${v} %`);
  return (
    <details className="card" style={{ marginBottom: 12 }} onToggle={ouvrir}>
      <summary><b>{t('tvaCarte.historyTitle')}</b></summary>
      <p className="small" style={{ margin: '6px 0 10px' }}>{t('tvaCarte.historyHelp')}</p>
      {erreur && <p className="small" style={{ color: 'var(--red)' }}>{erreur}</p>}
      {lignes && !lignes.length && <p className="small">{t('tvaCarte.historyEmpty')}</p>}
      {lignes && lignes.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th>{t('tvaCarte.colWhen')}</th><th>{t('tvaCarte.colDish')}</th><th>{t('tvaCarte.colChange')}</th><th>{t('tvaCarte.colWho')}</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((h) => (
                <tr key={h.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td>{new Date(h.at).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{h.itemName}</td>
                  <td>{t(h.field === 'price' ? 'tvaCarte.fieldPrice' : 'tvaCarte.fieldVat')} : {valeur(h, h.oldValue)} → {valeur(h, h.newValue)}</td>
                  <td>
                    {t(`tvaCarte.origin_${h.origin || 'script'}`)}
                    {h.requestedBy ? ` — ${t('tvaCarte.requestedBy', { name: h.requestedBy })}` : ''}
                    {h.actorName ? ` (${h.actorName})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
