import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { titreRangee, libellePosition, euros, jourCourt } from '../../misesEnAvant';
import { RESTAURANT_TYPES, restaurantTypeLabel } from '../../menuCategories';

// Admin › Mises en avant (fondateur, 2026-10-02) : le prix de la 1re, 2e et 3e position de chaque rangée de la liste
// (par semaine, hors TVA), et les demandes des commerçants à accepter ou refuser. Changer un prix ne touche pas les
// demandes déjà faites : chacune garde le prix du jour où elle a été posée.
const FACTURATION = ['a_facturer', 'facture', 'paye'];

export default function AdminPlacementsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [etat, setEtat] = useState(null);
  const [brouillon, setBrouillon] = useState({}); // « rangée:position » → saisie
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(() => {
    api('/admin/placements', { token }).then((r) => { setEtat(r); setBrouillon({}); }).catch((e) => toast(e.message, 'erreur'));
  }, [token, toast]);
  useEffect(() => { charger(); }, [charger]);

  const titre = (cle, repli) => titreRangee(tr, { key: cle, label: repli });
  const [aAjouter, setAAjouter] = useState('');
  const nbPositions = etat?.positions || etat?.sections[0]?.prices.length || 3;
  const colonnes = { gridTemplateColumns: `minmax(120px, 1.3fr) repeat(${nbPositions}, minmax(84px, 1fr)) 40px`, minWidth: 160 + nbPositions * 90 };
  // Rangées qu'on peut encore ouvrir à la vente : les deux rangées « livraison », puis une par type de cuisine.
  const dejaLa = new Set((etat?.sections || []).map((s) => s.key));
  const rangeesPossibles = [
    ...Object.keys(etat?.optional || {}).filter((k) => !dejaLa.has(k)).map((k) => ({ valeur: `key:${k}`, libelle: titreRangee(tr, { key: k, label: etat.optional[k] }) })),
    ...RESTAURANT_TYPES.filter((c) => !dejaLa.has(`cuisine:${c.value}`)).map((c) => ({ valeur: `cuisine:${c.value}`, libelle: `${c.emoji || ''} ${restaurantTypeLabel(c.value, tr) || c.value}`.trim() }))
  ];
  async function reglerPositions(n) {
    setOccupe(true);
    try { await api('/admin/placements/positions', { method: 'PUT', token, body: { count: n } }); toast(tr('adminPlacements.positionsSaved', { n })); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function ajouterRangee() {
    if (!aAjouter) return;
    const [genre, ...reste] = aAjouter.split(':'); const valeur = reste.join(':');
    setOccupe(true);
    try { await api('/admin/placements/sections', { method: 'POST', token, body: genre === 'key' ? { key: valeur } : { cuisine: valeur } }); toast(tr('adminPlacements.rowAdded')); setAAjouter(''); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function retirerRangee(s) {
    setOccupe(true);
    try { await api(`/admin/placements/sections/${encodeURIComponent(s.key)}`, { method: 'DELETE', token }); toast(tr('adminPlacements.rowRemoved')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  const modifies = Object.keys(brouillon).length;

  async function enregistrerPrix() {
    const prices = Object.entries(brouillon).map(([cle, v]) => {
      const [sectionKey, slot] = cle.split(':');
      return { sectionKey, slot: Number(slot), weeklyPrice: Number(String(v).replace(',', '.')) };
    });
    if (prices.some((p) => !Number.isFinite(p.weeklyPrice) || p.weeklyPrice < 0)) { toast(tr('adminPlacements.priceInvalid'), 'erreur'); return; }
    setOccupe(true);
    try { await api('/admin/placements/prices', { method: 'PUT', token, body: { prices } }); toast(tr('adminPlacements.pricesSaved')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function decider(b, corps) {
    setOccupe(true);
    try { await api(`/admin/placements/${b.id}`, { method: 'PATCH', token, body: corps }); toast(tr('adminPlacements.saved')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  const enAttente = (etat?.bookings || []).filter((b) => b.status === 'pending');
  const autres = (etat?.bookings || []).filter((b) => b.status !== 'pending');

  return (
    <div>
      <AdminPageHeader module="placements" />
      <p className="small" style={{ margin: '0 0 16px', maxWidth: 780 }}>{tr('adminPlacements.intro')}</p>
      {!etat && <p className="small">…</p>}
      {etat && (
        <>
          <div className="card" style={{ margin: '0 0 16px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{tr('adminPlacements.pricesTitle')}</h3>
            <p className="small" style={{ margin: '0 0 10px', color: 'var(--ink-soft)' }}>{tr('adminPlacements.pricesHelp')}</p>
            <div className="mea-grille mea-grille--admin mea-grille--large">
              <div className="mea-ligne mea-entete" style={colonnes}>
                <span>{tr('placements.row')}</span>
                {etat.sections[0]?.prices.map((p) => <span key={p.slot}>{libellePosition(tr, p.slot)}</span>)}
                <span />
              </div>
              {etat.sections.map((s) => (
                <div className="mea-ligne" key={s.key} style={colonnes}>
                  <span className="mea-rangee">{titreRangee(tr, s)}</span>
                  {s.prices.map((p) => {
                    const cle = `${s.key}:${p.slot}`;
                    return (
                      <label key={p.slot} className="mea-prix">
                        <input type="text" inputMode="decimal" value={brouillon[cle] ?? String(p.weeklyPrice).replace('.', ',')}
                          aria-label={`${titreRangee(tr, s)} — ${libellePosition(tr, p.slot)}`}
                          onChange={(e) => setBrouillon((b) => ({ ...b, [cle]: e.target.value }))} />
                        <span>€</span>
                      </label>
                    );
                  })}
                  {/* Une rangée ajoutée se retire (si personne ne l'occupe) ; les sept d'origine restent. */}
                  {s.custom
                    ? <button type="button" className="btn-ghost mea-retirer" disabled={occupe} title={tr('adminPlacements.removeRow')} aria-label={`${tr('adminPlacements.removeRow')} : ${titreRangee(tr, s)}`} onClick={() => retirerRangee(s)}>✕</button>
                    : <span />}
                </div>
              ))}
            </div>
            {/* Vendre une position de plus (ou de moins), ouvrir une rangée de plus. */}
            <div className="mea-outils">
              <button type="button" className="btn-outline" disabled={occupe || nbPositions >= (etat.maxPositions || 10)} onClick={() => reglerPositions(nbPositions + 1)}>+ {tr('adminPlacements.addPosition')}</button>
              {nbPositions > 1 && <button type="button" className="btn-ghost" disabled={occupe} onClick={() => reglerPositions(nbPositions - 1)}>− {tr('adminPlacements.removePosition', { n: nbPositions })}</button>}
              <span className="mea-outils-rangee">
                <select value={aAjouter} onChange={(e) => setAAjouter(e.target.value)} aria-label={tr('adminPlacements.addRow')} disabled={occupe || rangeesPossibles.length === 0}>
                  <option value="">{tr('adminPlacements.addRowPlaceholder')}</option>
                  {rangeesPossibles.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
                </select>
                <button type="button" className="btn-outline" disabled={occupe || !aAjouter} onClick={ajouterRangee}>+ {tr('adminPlacements.addRow')}</button>
              </span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn-teal" disabled={!modifies || occupe} onClick={enregistrerPrix}>{tr('adminPlacements.savePrices')}</button>
              {modifies > 0 && <button type="button" className="btn-ghost" disabled={occupe} onClick={() => setBrouillon({})}>{tr('common.cancel')}</button>}
            </div>
          </div>

          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{tr('adminPlacements.pendingTitle', { n: enAttente.length })}</h3>
          {enAttente.length === 0 && <div className="empty">{tr('adminPlacements.nonePending')}</div>}
          {enAttente.map((b) => (
            <div className="card mea-reservation" key={b.id} style={{ margin: '0 0 8px' }}>
              <div>
                <b>{b.restaurantName}</b>
                <span className="small" style={{ display: 'block' }}>{titre(b.sectionKey, b.sectionLabel)} · {libellePosition(tr, b.slot)} · {jourCourt(b.startsOn)} → {jourCourt(b.endsOn)}</span>
                <span className="small" style={{ display: 'block' }}>{euros(b.totalHt)} {tr('placements.exVat')} ({tr('placements.weeks', { n: b.weeks })} × {euros(b.weeklyPrice)})</span>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-teal" disabled={occupe} onClick={() => decider(b, { action: 'approve' })}>{tr('adminPlacements.approve')}</button>
                <button type="button" className="btn-danger-ghost" disabled={occupe} onClick={() => decider(b, { action: 'refuse' })}>{tr('adminPlacements.refuse')}</button>
              </div>
            </div>
          ))}

          <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>{tr('adminPlacements.historyTitle')}</h3>
          {autres.length === 0 && <div className="empty">{tr('adminPlacements.noneYet')}</div>}
          {autres.map((b) => (
            <div className="card mea-reservation" key={b.id} style={{ margin: '0 0 8px' }}>
              <div>
                <b>{b.restaurantName}</b> <span className={`modif-statut mea-statut--${b.status}`}>{tr(`placements.status_${b.status}`)}</span>
                <span className="small" style={{ display: 'block' }}>{titre(b.sectionKey, b.sectionLabel)} · {libellePosition(tr, b.slot)} · {jourCourt(b.startsOn)} → {jourCourt(b.endsOn)} · {euros(b.totalHt)} {tr('placements.exVat')}</span>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {['active', 'ended'].includes(b.status) && (
                  <select value={b.billingStatus} disabled={occupe} aria-label={tr('adminPlacements.billing')} onChange={(e) => decider(b, { billingStatus: e.target.value })}>
                    {FACTURATION.map((f) => <option key={f} value={f}>{tr(`adminPlacements.billing_${f}`)}</option>)}
                  </select>
                )}
                {b.status === 'active' && <button type="button" className="btn-danger-ghost" disabled={occupe} onClick={() => decider(b, { action: 'cancel' })}>{tr('adminPlacements.stop')}</button>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
