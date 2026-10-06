import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { titreRangee, libellePosition, euros, jourCourt } from '../../misesEnAvant';
import { RESTAURANT_TYPES, restaurantTypeLabel, COMMUNES_SUGGEREES } from '../../menuCategories';

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
  // UNE PAGE PAR COMMUNE (fondateur, 2026-10-06) : '' = les prix par défaut et toutes les demandes ; sinon la commune choisie,
  // avec son interrupteur d'ouverture et ses prix propres (une case vide = le prix par défaut).
  // ET PAR ZONE (même jour) : une zone = un groupe de communes nommé, avec son ouverture et ses prix ; `commune` vaut alors
  // 'zone:<id>'. Ordre des prix : commune > zone > défaut. L'admin ajoute des communes et des zones lui-même.
  const [commune, setCommune] = useState('');
  const zoneId = commune.startsWith('zone:') ? commune.slice(5) : '';
  const nomPortee = zoneId ? (etat?.zone?.name || '') : commune;
  const [nouvelleCommune, setNouvelleCommune] = useState('');
  const [nouvelleZone, setNouvelleZone] = useState({ ouvert: false, name: '', communes: [] });
  const [communesZone, setCommunesZone] = useState(null); // modification des communes de la zone affichée

  const charger = useCallback(() => {
    const q = commune.startsWith('zone:') ? `?zone=${encodeURIComponent(commune.slice(5))}` : commune ? `?commune=${encodeURIComponent(commune)}` : '';
    api(`/admin/placements${q}`, { token }).then((r) => { setEtat(r); setBrouillon({}); setCommunesZone(null); }).catch((e) => toast(e.message, 'erreur'));
  }, [token, toast, commune]);
  async function ouvrirCommune(enabled) {
    setOccupe(true);
    try {
      if (zoneId) await api(`/admin/placements/zones/${zoneId}`, { method: 'PUT', token, body: { enabled } });
      else await api(`/admin/placements/communes/${encodeURIComponent(commune)}`, { method: 'PUT', token, body: { enabled } });
      toast(tr(enabled ? 'adminPlacements.communeOpened' : 'adminPlacements.communeClosed', { commune: nomPortee })); charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function ajouterCommune() {
    const nom = nouvelleCommune.trim(); if (!nom) return;
    setOccupe(true);
    try { await api('/admin/placements/communes', { method: 'POST', token, body: { commune: nom } }); toast(tr('adminPlacements.communeAdded', { commune: nom })); setNouvelleCommune(''); setCommune(nom); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function ajouterZone() {
    if (!nouvelleZone.name.trim() || !nouvelleZone.communes.length) { toast(tr('adminPlacements.zoneIncomplete'), 'erreur'); return; }
    setOccupe(true);
    try { const r = await api('/admin/placements/zones', { method: 'POST', token, body: { name: nouvelleZone.name.trim(), communes: nouvelleZone.communes } }); toast(tr('adminPlacements.zoneAdded', { zone: r.zone.name })); setNouvelleZone({ ouvert: false, name: '', communes: [] }); setCommune(`zone:${r.zone.id}`); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function enregistrerCommunesZone() {
    if (!communesZone || !communesZone.length) { toast(tr('adminPlacements.zoneIncomplete'), 'erreur'); return; }
    setOccupe(true);
    try { await api(`/admin/placements/zones/${zoneId}`, { method: 'PUT', token, body: { communes: communesZone } }); toast(tr('adminPlacements.saved')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function retirerZone() {
    if (!window.confirm(tr('adminPlacements.zoneRemoveConfirm', { zone: nomPortee }))) return;
    setOccupe(true);
    try { await api(`/admin/placements/zones/${zoneId}`, { method: 'DELETE', token }); toast(tr('adminPlacements.zoneRemoved')); setCommune(''); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  // Communes qu'on peut proposer : les 19 et la périphérie, plus celles déjà connues, sans doublon.
  const communesConnues = (etat?.communes || []).map((c) => c.commune);
  const communesProposees = [...new Set([...communesConnues, ...COMMUNES_SUGGEREES])].sort((a, b) => a.localeCompare(b, 'fr'));
  const basculerCommune = (liste, c) => (liste.includes(c) ? liste.filter((x) => x !== c) : [...liste, c]);
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
      // Dans une commune, vider la case = revenir au prix par défaut.
      return { sectionKey, slot: Number(slot), weeklyPrice: commune && String(v).trim() === '' ? null : Number(String(v).replace(',', '.')) };
    });
    if (prices.some((p) => p.weeklyPrice !== null && (!Number.isFinite(p.weeklyPrice) || p.weeklyPrice < 0))) { toast(tr('adminPlacements.priceInvalid'), 'erreur'); return; }
    setOccupe(true);
    try { await api('/admin/placements/prices', { method: 'PUT', token, body: zoneId ? { zone: zoneId, prices } : { commune: commune || undefined, prices } }); toast(tr('adminPlacements.pricesSaved')); charger(); }
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
      <p className="small" style={{ margin: '0 0 16px', maxWidth: 780 }}>{tr('adminPlacements.intro')} {tr('adminPlacements.introCommune')}</p>
      {!etat && <p className="small">…</p>}
      {etat && (
        <>
          {/* La commune ou la zone dont on règle la page : ses commerces, ses demandes, son ouverture. */}
          <div className="card mea-communes" style={{ margin: '0 0 16px' }}>
            <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label htmlFor="mea-commune" style={{ fontWeight: 700 }}>{tr('adminPlacements.scopeLabel')}</label>
              <select id="mea-commune" value={commune} disabled={occupe} onChange={(e) => setCommune(e.target.value)}>
                <option value="">{tr('adminPlacements.communeDefault')}</option>
                {(etat.zones || []).length > 0 && (
                  <optgroup label={tr('adminPlacements.zonesGroup')}>
                    {etat.zones.map((z) => <option key={z.id} value={`zone:${z.id}`}>{z.name} ({z.communes.length}) — {z.enabled ? tr('adminPlacements.open') : tr('adminPlacements.closed')} · {tr('adminPlacements.communeCounts', { restaurants: z.restaurants, pending: z.pending, active: z.active })}</option>)}
                  </optgroup>
                )}
                <optgroup label={tr('adminPlacements.communesGroup')}>
                  {(etat.communes || []).map((c) => <option key={c.commune} value={c.commune}>{c.commune}{c.zoneName ? ` · ${c.zoneName}` : ''} — {c.enabled ? tr('adminPlacements.open') : tr('adminPlacements.closed')} · {tr('adminPlacements.communeCounts', { restaurants: c.restaurants, pending: c.pending, active: c.active })}</option>)}
                </optgroup>
              </select>
              {commune && (
                <>
                  <span className={`modif-statut mea-statut--${etat.enabled ? 'active' : 'cancelled'}`}>{etat.enabled ? tr('adminPlacements.open') : tr('adminPlacements.closed')}</span>
                  {!zoneId && etat.enabled && !etat.ownEnabled && etat.viaZone && <span className="small">{tr('adminPlacements.openViaZone', { zone: etat.viaZone })}</span>}
                  <button type="button" className={(zoneId ? etat.enabled : etat.ownEnabled) ? 'btn-danger-ghost' : 'btn-teal'} disabled={occupe} onClick={() => ouvrirCommune(!(zoneId ? etat.enabled : etat.ownEnabled))}>{(zoneId ? etat.enabled : etat.ownEnabled) ? tr('adminPlacements.close') : tr('adminPlacements.openAction')}</button>
                  {zoneId && <button type="button" className="btn-ghost" disabled={occupe} onClick={retirerZone}>{tr('adminPlacements.zoneRemove')}</button>}
                </>
              )}
            </div>
            <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{zoneId ? tr('adminPlacements.zoneHelp', { zone: nomPortee }) : commune ? tr('adminPlacements.communeHelp', { commune }) : tr('adminPlacements.defaultHelp')}</p>
            {/* Les communes de la zone affichée, modifiables. */}
            {zoneId && etat.zone && (
              <div className="mea-zone-communes">
                <b className="small">{tr('adminPlacements.zoneCommunes')}</b>
                <div className="mea-cases">
                  {communesProposees.map((c) => {
                    const liste = communesZone || etat.zone.communes;
                    const autreZone = (etat.communes || []).find((x) => x.commune === c)?.zoneId;
                    const ailleurs = autreZone && autreZone !== zoneId;
                    return <label key={c} className={`mea-case-commune${ailleurs ? ' est-ailleurs' : ''}`}><input type="checkbox" disabled={occupe || ailleurs} checked={liste.includes(c)} onChange={() => setCommunesZone(basculerCommune(liste, c))} /> {c}</label>;
                  })}
                </div>
                {communesZone && <div className="row" style={{ gap: 8, marginTop: 8 }}><button type="button" className="btn-teal" disabled={occupe} onClick={enregistrerCommunesZone}>{tr('adminPlacements.saveZoneCommunes')}</button><button type="button" className="btn-ghost" disabled={occupe} onClick={() => setCommunesZone(null)}>{tr('common.cancel')}</button></div>}
              </div>
            )}
            {/* Ajouter une commune (sans attendre un commerce), ou une zone. */}
            {!commune && (
              <div className="mea-outils" style={{ marginTop: 12 }}>
                <span className="mea-outils-rangee" style={{ marginLeft: 0 }}>
                  <input list="mea-communes-liste" value={nouvelleCommune} placeholder={tr('adminPlacements.addCommunePlaceholder')} aria-label={tr('adminPlacements.addCommune')} disabled={occupe} onChange={(e) => setNouvelleCommune(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterCommune(); } }} />
                  <datalist id="mea-communes-liste">{communesProposees.filter((c) => !communesConnues.includes(c)).map((c) => <option key={c} value={c} />)}</datalist>
                  <button type="button" className="btn-outline" disabled={occupe || !nouvelleCommune.trim()} onClick={ajouterCommune}>+ {tr('adminPlacements.addCommune')}</button>
                </span>
                <button type="button" className="btn-outline" disabled={occupe} onClick={() => setNouvelleZone((z) => ({ ...z, ouvert: !z.ouvert }))}>+ {tr('adminPlacements.addZone')}</button>
              </div>
            )}
            {!commune && nouvelleZone.ouvert && (
              <div className="mea-zone-communes">
                <input value={nouvelleZone.name} placeholder={tr('adminPlacements.zoneNamePlaceholder')} aria-label={tr('adminPlacements.zoneName')} disabled={occupe} onChange={(e) => setNouvelleZone((z) => ({ ...z, name: e.target.value }))} style={{ maxWidth: 320 }} />
                <b className="small" style={{ display: 'block', marginTop: 8 }}>{tr('adminPlacements.zoneCommunes')}</b>
                <div className="mea-cases">
                  {communesProposees.map((c) => {
                    const ailleurs = !!(etat.communes || []).find((x) => x.commune === c)?.zoneId;
                    return <label key={c} className={`mea-case-commune${ailleurs ? ' est-ailleurs' : ''}`}><input type="checkbox" disabled={occupe || ailleurs} checked={nouvelleZone.communes.includes(c)} onChange={() => setNouvelleZone((z) => ({ ...z, communes: basculerCommune(z.communes, c) }))} /> {c}</label>;
                  })}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 8 }}><button type="button" className="btn-teal" disabled={occupe} onClick={ajouterZone}>{tr('adminPlacements.createZone')}</button><button type="button" className="btn-ghost" disabled={occupe} onClick={() => setNouvelleZone({ ouvert: false, name: '', communes: [] })}>{tr('common.cancel')}</button></div>
              </div>
            )}
          </div>
          <div className="card" style={{ margin: '0 0 16px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{commune ? tr('adminPlacements.pricesTitleCommune', { commune: nomPortee }) : tr('adminPlacements.pricesTitle')}</h3>
            <p className="small" style={{ margin: '0 0 10px', color: 'var(--ink-soft)' }}>{zoneId ? tr('adminPlacements.pricesHelpZone') : commune ? tr('adminPlacements.pricesHelpCommune') : tr('adminPlacements.pricesHelp')}</p>
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
                        <input type="text" inputMode="decimal" value={brouillon[cle] ?? (commune && !p.ownPrice ? '' : String(p.weeklyPrice).replace('.', ','))}
                          placeholder={commune && !p.ownPrice ? String(p.weeklyPrice).replace('.', ',') : undefined}
                          title={p.zonePrice ? tr('adminPlacements.fromZone') : undefined} className={p.zonePrice ? 'est-zone' : undefined}
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
                <b>{b.restaurantName}</b>{!commune && b.commune && <span className="small"> · {b.commune}</span>}
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
                <b>{b.restaurantName}</b>{!commune && b.commune && <span className="small"> · {b.commune}</span>} <span className={`modif-statut mea-statut--${b.status}`}>{tr(`placements.status_${b.status}`)}</span>
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
