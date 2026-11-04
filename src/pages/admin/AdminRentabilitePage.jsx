import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import RecordDrawer from '../../components/admin/RecordDrawer';
import ConfirmDialog from '../../components/ConfirmDialog';
import { money, fmtDate } from './adminUtils';
import { useApiData, LoadState } from './accounting/common';
import { simuler, pointMort, margeCommande } from './rentabilite/calcul';
import '../../admin-finance.css';

/* Admin › Finances › Coûts et rentabilité (Owen, 2026-11-04 : « voir tous mes coûts de chaque mois, des projections — que se
 * passe-t-il à 200 commandes par mois — et combien il en faut pour être à l'équilibre »).
 *
 * Vue de GESTION, à côté de la comptabilité et jamais dedans : les coûts fixes et de départ sont ceux que l'équipe saisit
 * ici (montants ronds, de mémoire), les vraies factures restent dans Comptabilité › Dépenses. Le serveur (backend
 * rentabilite.js) rend les coûts, le réel mois par mois, les moyennes des 90 derniers jours et les tarifs ; la simulation
 * se calcule ici (rentabilite/calcul.js) à chaque frappe. Les hypothèses de la simulation restent dans ce navigateur. */

const CATEGORIES_FIXES = ['infrastructure', 'social', 'assurance', 'abonnement', 'banque', 'autre'];
const CATEGORIES_DEPART = ['materiel', 'creation', 'marketing', 'autre'];
const PERIODICITES = ['mois', 'trimestre', 'an'];
const CLE_HYPOTHESES = 'fairide.admin.rentabilite.hypotheses';
const PALIERS = [100, 200, 500, 1000];

// Hypothèses de départ : la réalité des 90 derniers jours quand elle existe, sinon l'analyse du 04/11/2026 (panier de 25 €,
// livraison de 6,30 € pour ~4 km, 60 % Bancontact, après GO surtout des livraisons).
function hypothesesParDefaut(d) {
  return {
    commandes: 200,
    panier: d.reel?.panierMoyen ?? 25,
    livraison: d.reel?.livraisonMoyenne ?? 6.3,
    partLivraison: 80,
    partEmporterEnLigne: 10,
    partBancontact: 60,
    commerces: d.parc?.commerces || 30,
    livreurs: d.parc?.livreurs || 10
  };
}
function lireHypotheses(d) {
  const base = hypothesesParDefaut(d);
  try {
    const gardees = JSON.parse(localStorage.getItem(CLE_HYPOTHESES) || 'null');
    if (gardees && typeof gardees === 'object') return { ...base, ...gardees };
  } catch { /* stockage indisponible (navigation privée) : on garde les valeurs par défaut */ }
  return base;
}

const nombre = (n, dec = 0) => Number(n || 0).toLocaleString(getLocale(), { maximumFractionDigits: dec, minimumFractionDigits: 0 });
// Euros sans centimes : les grands montants des tuiles (« −9 722 € » tenait sur deux lignes avec ses centimes).
const eurosRonds = (n) => Number(n || 0).toLocaleString(getLocale(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const signe = (n) => (n < 0 ? 'fin-neg' : 'fin-pos');
const nomMois = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });

export default function AdminRentabilitePage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const vue = useApiData(() => api('/admin/rentabilite', { token }), [token]);
  return (
    <div>
      <AdminPageHeader module="rentabilite" />
      <p className="small" style={{ margin: '0 0 16px', maxWidth: 780 }}>{tr('adminRentabilite.intro')}</p>
      <LoadState state={vue} skeleton={4}>{(d) => <Contenu d={d} recharger={vue.reload} />}</LoadState>
    </div>
  );
}

function Contenu({ d, recharger }) {
  const { t: tr } = useLanguage();
  const [h, setH] = useState(() => lireHypotheses(d));
  useEffect(() => {
    try { localStorage.setItem(CLE_HYPOTHESES, JSON.stringify(h)); } catch { /* sans stockage, la simulation marche quand même */ }
  }, [h]);
  const fixes = d.totaux.fixesParMois;
  const sim = useMemo(() => simuler(h, d.tarifs, d.prix, fixes), [h, d, fixes]);
  const pm = useMemo(() => pointMort(h, d.tarifs, d.prix, fixes), [h, d, fixes]);
  const courant = d.mois.at(-1);
  const cumul = courant ? courant.cumulAvecDepart : -d.totaux.depart;
  const commandesCeMois = courant ? courant.livraisons + courant.livraisonsCommerce + courant.emporterEnLigne + courant.emporterAuCommerce : 0;

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card highlight"><div className="num">{money(fixes)}</div><div className="label">{tr('adminRentabilite.tuileFixes')}</div></div>
        <div className="stat-card highlight">
          <div className="num">{pm == null ? '–' : nombre(pm)}</div>
          <div className="label">{pm == null ? tr('adminRentabilite.tuilePointMortJamais') : tr('adminRentabilite.tuilePointMort', { jour: nombre(pm / 30, 1) })}</div>
        </div>
        <div className="stat-card"><div className="num">{money(sim.netParCommande)}</div><div className="label">{tr('adminRentabilite.tuileNet')}</div></div>
        <div className="stat-card"><div className="num">{eurosRonds(d.totaux.depart)}</div><div className="label">{tr('adminRentabilite.tuileDepart')}</div></div>
        <div className="stat-card"><div className={`num ${signe(cumul)}`}>{eurosRonds(cumul)}</div><div className="label">{tr('adminRentabilite.tuileCumul')}</div></div>
        <div className="stat-card"><div className="num">{nombre(commandesCeMois)}</div><div className="label">{tr('adminRentabilite.tuileCeMois')}</div></div>
      </div>

      <Simulateur d={d} h={h} setH={setH} sim={sim} pm={pm} cumul={cumul} />
      <MoisParMois mois={d.mois} />
      <CoutsFixes couts={d.coutsFixes} total={fixes} recharger={recharger} />
      <CoutsDepart couts={d.coutsDepart} total={d.totaux.depart} recharger={recharger} />
    </>
  );
}

function Simulateur({ d, h, setH, sim, pm, cumul }) {
  const { t: tr } = useLanguage();
  const ids = useId();
  const champ = (k) => (e) => setH((s) => ({ ...s, [k]: e.target.value === '' ? '' : Number(e.target.value) }));
  const auCommerce = Math.max(0, 100 - (Number(h.partLivraison) || 0) - (Number(h.partEmporterEnLigne) || 0));
  const maxCurseur = Math.max(1000, Math.ceil(((pm || 0) * 2) / 100) * 100, Number(h.commandes) || 0);
  const parCompte = d.tarifs.compteActifMois + d.tarifs.virementsParMois * d.tarifs.virementFixe;
  const aRecuperer = Math.max(0, -cumul);
  const moisPourRecuperer = sim.resultat > 0 && aRecuperer > 0 ? Math.ceil(aRecuperer / sim.resultat) : null;
  const types = ['livraison', 'emporterEnLigne', 'emporterCommerce'];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{tr('adminRentabilite.simTitre')}</h3>
      <p className="small" style={{ margin: '0 0 12px', opacity: 0.8 }}>{tr('adminRentabilite.simAide')}</p>

      <div className="field">
        <label htmlFor={ids + '-n'}>{tr('adminRentabilite.simCommandes')}</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input id={ids + '-n'} type="number" min="0" step="10" inputMode="numeric" value={h.commandes} onChange={champ('commandes')} style={{ width: 110 }} />
          <input type="range" min="0" max={maxCurseur} step="10" value={Number(h.commandes) || 0} onChange={champ('commandes')} aria-label={tr('adminRentabilite.simCommandes')} style={{ flex: '1 1 200px' }} />
        </div>
        <div className="fin-quick" style={{ marginTop: 8 }}>
          {PALIERS.map((p) => <button key={p} type="button" className={`chip${Number(h.commandes) === p ? ' active' : ''}`} onClick={() => setH((s) => ({ ...s, commandes: p }))}>{nombre(p)}</button>)}
          {pm != null && <button type="button" className={`chip${Number(h.commandes) === pm ? ' active' : ''}`} onClick={() => setH((s) => ({ ...s, commandes: pm }))}>{tr('adminRentabilite.simAuPointMort', { n: nombre(pm) })}</button>}
        </div>
        <span className="small" style={{ opacity: 0.75 }}>{tr('adminRentabilite.simParJour', { n: nombre((Number(h.commandes) || 0) / 30, 1) })}</span>
      </div>

      <details style={{ margin: '14px 0' }}>
        <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>{tr('adminRentabilite.simHypotheses')}</summary>
        <div className="fin-form-grid" style={{ marginTop: 10 }}>
          <Champ id={ids + '-panier'} label={tr('adminRentabilite.hPanier')} aide={d.reel?.panierMoyen != null ? tr('adminRentabilite.hReel', { v: money(d.reel.panierMoyen), n: d.reel.livraisons90j }) : tr('adminRentabilite.hPanierAide')} value={h.panier} onChange={champ('panier')} step="0.5" />
          <Champ id={ids + '-livraison'} label={tr('adminRentabilite.hLivraison')} aide={d.reel?.livraisonMoyenne != null ? tr('adminRentabilite.hReel', { v: money(d.reel.livraisonMoyenne), n: d.reel.livraisons90j }) : tr('adminRentabilite.hLivraisonAide', { base: money(d.prix.livraisonBase), km: d.prix.livraisonBaseKm, parKm: money(d.prix.livraisonParKm) })} value={h.livraison} onChange={champ('livraison')} step="0.1" />
          <Champ id={ids + '-pl'} label={tr('adminRentabilite.hPartLivraison')} value={h.partLivraison} onChange={champ('partLivraison')} max="100" />
          <Champ id={ids + '-pe'} label={tr('adminRentabilite.hPartEmporter')} aide={tr('adminRentabilite.hAuCommerce', { n: auCommerce })} value={h.partEmporterEnLigne} onChange={champ('partEmporterEnLigne')} max="100" />
          <Champ id={ids + '-bc'} label={tr('adminRentabilite.hBancontact')} aide={tr('adminRentabilite.hBancontactAide')} value={h.partBancontact} onChange={champ('partBancontact')} max="100" />
          <Champ id={ids + '-co'} label={tr('adminRentabilite.hCommerces')} aide={tr('adminRentabilite.hCommercesAide', { n: d.parc.commerces })} value={h.commerces} onChange={champ('commerces')} />
          <Champ id={ids + '-li'} label={tr('adminRentabilite.hLivreurs')} aide={tr('adminRentabilite.hLivreursAide', { n: d.parc.livreurs })} value={h.livreurs} onChange={champ('livreurs')} />
        </div>
        <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setH((s) => ({ ...hypothesesParDefaut(d), commandes: s.commandes }))}>{tr('adminRentabilite.simReinitialiser')}</button>
      </details>

      <div className="fin-two-col">
        <div className="fin-statement fin-result">
          <div className="fin-statement-head"><span>{tr('adminRentabilite.resTitre', { n: nombre(sim.commandes) })}</span></div>
          <Ligne label={tr('adminRentabilite.resRevenu')} montant={sim.revenu} />
          <Ligne label={tr('adminRentabilite.resStripe')} montant={-sim.stripe} />
          <Ligne label={tr('adminRentabilite.resVirements')} montant={-sim.virement} />
          <Ligne label={tr('adminRentabilite.resDivers')} montant={-sim.divers} />
          <Ligne label={tr('adminRentabilite.resConnect', { c: sim.commercesPayes, l: sim.livreursPayes, prix: money(parCompte) })} montant={-sim.connect} />
          <Ligne label={tr('adminRentabilite.resFixes')} montant={-sim.coutsFixes} />
          <div className="fin-statement-total"><span>{tr('adminRentabilite.resResultat')}</span><span className={`fin-num ${signe(sim.resultat)}`}>{money(sim.resultat)}</span></div>
          <p className="small" style={{ margin: 0, padding: '10px 16px' }}>
            {sim.resultat < 0 && (pm != null ? tr('adminRentabilite.resManque', { n: nombre(pm - sim.commandes) }) : tr('adminRentabilite.tuilePointMortJamais'))}
            {sim.resultat >= 0 && (moisPourRecuperer != null ? tr('adminRentabilite.resRecuperer', { montant: money(aRecuperer), n: moisPourRecuperer }) : tr('adminRentabilite.resRecupere'))}
          </p>
        </div>
        <div>
          <Courbe h={h} d={d} pm={pm} max={maxCurseur} />
          <div className="fin-table-wrap" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead><tr><th>{tr('adminRentabilite.parTitre')}</th><th className="fin-num">{tr('adminRentabilite.parGarde')}</th><th className="fin-num">{tr('adminRentabilite.parFrais')}</th><th className="fin-num">{tr('adminRentabilite.parReste')}</th></tr></thead>
              <tbody>
                {types.map((type) => {
                  const m = margeCommande(type, h, d.tarifs, d.prix);
                  return (
                    <tr key={type}>
                      <td>{tr(`adminRentabilite.type_${type}`)}</td>
                      <td className="fin-num">{money(m.revenu)}</td>
                      <td className="fin-num">{money(-(m.stripe + m.virement + m.divers))}</td>
                      <td className={`fin-num ${signe(m.net)}`}><b>{money(m.net)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="small" style={{ margin: '12px 0 0', opacity: 0.75 }}>
        {tr('adminRentabilite.tarifs', {
          date: fmtDate(d.tarifs.luLe), carte: `${nombre(d.tarifs.cartePourcent, 2)} % + ${money(d.tarifs.carteFixe)}`, bancontact: money(d.tarifs.bancontact),
          compte: money(d.tarifs.compteActifMois), virement: money(d.tarifs.virementFixe), pourcent: nombre(d.tarifs.virementPourcent, 2)
        })}
      </p>
    </div>
  );
}

function Champ({ id, label, aide, value, onChange, step = '1', max }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min="0" max={max} step={step} inputMode="decimal" value={value} onChange={onChange} />
      {aide && <span className="small" style={{ opacity: 0.75 }}>{aide}</span>}
    </div>
  );
}

function Ligne({ label, montant }) {
  return <div className="fin-statement-line"><span>{label}</span><span className="fin-num">{money(montant)}</span></div>;
}

// Le résultat du mois selon le nombre de commandes (mêmes hypothèses) : où la courbe croise zéro, c'est le point mort.
function Courbe({ h, d, pm, max }) {
  const { t: tr } = useLanguage();
  const L = 320; const H = 150; const marge = 8;
  const points = Array.from({ length: 41 }, (_, i) => {
    const n = Math.round((max * i) / 40);
    return { n, r: simuler({ ...h, commandes: n }, d.tarifs, d.prix, d.totaux.fixesParMois).resultat };
  });
  const bas = Math.min(0, ...points.map((p) => p.r));
  const haut = Math.max(1, ...points.map((p) => p.r));
  const x = (n) => marge + ((L - 2 * marge) * n) / max;
  const y = (r) => marge + ((H - 2 * marge) * (haut - r)) / (haut - bas || 1);
  const actuel = simuler(h, d.tarifs, d.prix, d.totaux.fixesParMois);
  const nActuel = Math.min(max, Number(h.commandes) || 0);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${L} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={tr('adminRentabilite.courbeTitre')}>
        <line x1={marge} x2={L - marge} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth="1" />
        {pm != null && pm <= max && <line x1={x(pm)} x2={x(pm)} y1={marge} y2={H - marge} stroke="var(--ink-faint)" strokeDasharray="3 3" strokeWidth="1" />}
        <polyline fill="none" stroke="var(--iris)" strokeWidth="2" strokeLinejoin="round" points={points.map((p) => `${x(p.n).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ')} />
        <circle cx={x(nActuel)} cy={y(actuel.resultat)} r="4" fill={actuel.resultat < 0 ? 'var(--red)' : 'var(--teal-deep)'} />
      </svg>
      <figcaption className="fin-dualchart-axis">
        <span>0</span>
        <span>{tr('adminRentabilite.courbeTitre')}</span>
        <span>{nombre(max)}</span>
      </figcaption>
    </figure>
  );
}

function MoisParMois({ mois }) {
  const { t: tr } = useLanguage();
  return (
    <>
      <h3 style={{ margin: '24px 0 4px', fontSize: 16 }}>{tr('adminRentabilite.moisTitre')}</h3>
      <p className="small" style={{ margin: '0 0 10px', opacity: 0.8 }}>{tr('adminRentabilite.moisAide')}</p>
      <div className="fin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{tr('adminRentabilite.colMois')}</th>
              <th className="fin-num">{tr('adminRentabilite.colLivraisons')}</th>
              <th className="fin-num">{tr('adminRentabilite.colEmporter')}</th>
              <th className="fin-num">{tr('adminRentabilite.colAuCommerce')}</th>
              <th className="fin-num">{tr('adminRentabilite.colRevenu')}</th>
              <th className="fin-num">{tr('adminRentabilite.colStripe')}</th>
              <th className="fin-num">{tr('adminRentabilite.colFixes')}</th>
              <th className="fin-num">{tr('adminRentabilite.colResultat')}</th>
              <th className="fin-num">{tr('adminRentabilite.colCumul')}</th>
            </tr>
          </thead>
          <tbody>
            {[...mois].reverse().map((m) => (
              <tr key={m.mois}>
                <td><b>{nomMois(m.mois)}</b>{m.enCours && <span className="small"> · {tr('adminRentabilite.enCours')}</span>}</td>
                <td className="fin-num">{nombre(m.livraisons + m.livraisonsCommerce)}</td>
                <td className="fin-num">{nombre(m.emporterEnLigne)}</td>
                <td className="fin-num">{nombre(m.emporterAuCommerce)}</td>
                <td className="fin-num">{money(m.revenu)}</td>
                <td className="fin-num" title={tr('adminRentabilite.stripeDetail', { reel: money(m.fraisStripe), connect: money(m.connectEstime) })}>{money(-(m.fraisStripe + m.connectEstime))}</td>
                <td className="fin-num">{money(-m.coutsFixes)}</td>
                <td className={`fin-num ${signe(m.resultat)}`}><b>{money(m.resultat)}</b></td>
                <td className={`fin-num ${signe(m.cumulAvecDepart)}`}>{money(m.cumulAvecDepart)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CoutsFixes({ couts, total, recharger }) {
  const { t: tr } = useLanguage();
  const [edition, setEdition] = useState(null);
  return (
    <>
      <div className="fin-toolbar" style={{ margin: '24px 0 4px' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{tr('adminRentabilite.fixesTitre')}</h3>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={() => setEdition({ periodicite: 'mois', categorie: 'autre' })}>{tr('adminRentabilite.ajouter')}</button>
      </div>
      <p className="small" style={{ margin: '0 0 10px', opacity: 0.8 }}>{tr('adminRentabilite.fixesAide')}</p>
      {couts.length === 0 && <div className="empty">{tr('adminRentabilite.vide')}</div>}
      {couts.length > 0 && (
        <div className="fin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{tr('adminRentabilite.colLibelle')}</th>
                <th className="fin-num">{tr('adminRentabilite.colMontant')}</th><th className="fin-num">{tr('adminRentabilite.colParMois')}</th>
                <th>{tr('adminRentabilite.colPeriode')}</th>
              </tr>
            </thead>
            <tbody>
              {couts.map((c) => (
                <tr key={c.id} onClick={() => setEdition(c)} style={{ cursor: 'pointer', opacity: c.fin && c.fin < new Date().toISOString().slice(0, 10) ? 0.55 : 1 }}>
                  <td><b>{c.libelle}</b><div className="small" style={{ opacity: 0.75 }}>{[tr(`adminRentabilite.cat_${c.categorie}`), c.note].filter(Boolean).join(' · ')}</div></td>
                  <td className="fin-num">{tr(`adminRentabilite.montantPar_${c.periodicite}`, { montant: money(c.montant) })}</td>
                  <td className="fin-num"><b>{money(c.parMois)}</b></td>
                  <td className="small">{c.fin ? tr('adminRentabilite.periodeDuAu', { debut: fmtDate(c.debut), fin: fmtDate(c.fin) }) : tr('adminRentabilite.periodeDepuis', { debut: fmtDate(c.debut) })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={2}><b>{tr('adminRentabilite.totalParMois')}</b></td><td className="fin-num"><b>{money(total)}</b></td><td /></tr></tfoot>
          </table>
        </div>
      )}
      {edition && <FormulaireCout fixe cout={edition} onClose={() => setEdition(null)} onSaved={() => { setEdition(null); recharger(); }} />}
    </>
  );
}

function CoutsDepart({ couts, total, recharger }) {
  const { t: tr } = useLanguage();
  const [edition, setEdition] = useState(null);
  return (
    <>
      <div className="fin-toolbar" style={{ margin: '24px 0 4px' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{tr('adminRentabilite.departTitre')}</h3>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={() => setEdition({ categorie: 'materiel' })}>{tr('adminRentabilite.ajouter')}</button>
      </div>
      <p className="small" style={{ margin: '0 0 10px', opacity: 0.8 }}>{tr('adminRentabilite.departAide')}</p>
      {couts.length === 0 && <div className="empty">{tr('adminRentabilite.vide')}</div>}
      {couts.length > 0 && (
        <div className="fin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>{tr('adminRentabilite.colLibelle')}</th><th>{tr('adminRentabilite.colDate')}</th><th className="fin-num">{tr('adminRentabilite.colMontant')}</th></tr></thead>
            <tbody>
              {couts.map((c) => (
                <tr key={c.id} onClick={() => setEdition(c)} style={{ cursor: 'pointer' }}>
                  <td><b>{c.libelle}</b><div className="small" style={{ opacity: 0.75 }}>{[tr(`adminRentabilite.cat_${c.categorie}`), c.note].filter(Boolean).join(' · ')}</div></td>
                  <td className="small">{c.date ? fmtDate(c.date) : '–'}</td>
                  <td className="fin-num"><b>{money(c.montant)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={2}><b>{tr('adminRentabilite.totalDepart')}</b></td><td className="fin-num"><b>{money(total)}</b></td></tr></tfoot>
          </table>
        </div>
      )}
      {edition && <FormulaireCout cout={edition} onClose={() => setEdition(null)} onSaved={() => { setEdition(null); recharger(); }} />}
    </>
  );
}

// Ajouter ou modifier un coût. `fixe` : coût récurrent (périodicité, début, fin) ; sinon coût de départ (une date).
function FormulaireCout({ fixe = false, cout, onClose, onSaved }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const nouveau = !cout.id;
  const chemin = `/admin/rentabilite/${fixe ? 'couts-fixes' : 'couts-depart'}`;
  const [f, setF] = useState({
    libelle: cout.libelle || '', categorie: cout.categorie || 'autre', montant: cout.montant ?? '', note: cout.note || '',
    periodicite: cout.periodicite || 'mois', debut: cout.debut || new Date().toISOString().slice(0, 10), fin: cout.fin || '', date: cout.date || ''
  });
  const [occupe, setOccupe] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const valide = f.libelle.trim() && f.montant !== '' && Number(String(f.montant).replace(',', '.')) >= 0 && !occupe;

  async function enregistrer() {
    if (!valide) return;
    setOccupe(true);
    try {
      const body = fixe
        ? { libelle: f.libelle, categorie: f.categorie, montant: f.montant, note: f.note, periodicite: f.periodicite, debut: f.debut, fin: f.fin || null }
        : { libelle: f.libelle, categorie: f.categorie, montant: f.montant, note: f.note, date: f.date || null };
      if (nouveau) await api(chemin, { method: 'POST', token, body });
      else await api(`${chemin}/${cout.id}`, { method: 'PATCH', token, body });
      toast(tr('adminRentabilite.enregistre'));
      onSaved();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function supprimer() {
    setOccupe(true);
    try {
      await api(`${chemin}/${cout.id}`, { method: 'DELETE', token });
      toast(tr('adminRentabilite.supprime'));
      onSaved();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); setConfirmer(false); }
  }

  return createPortal(
    <RecordDrawer
      title={nouveau ? tr(fixe ? 'adminRentabilite.nouveauFixe' : 'adminRentabilite.nouveauDepart') : cout.libelle}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn-teal" disabled={!valide} onClick={enregistrer}>{occupe ? '...' : tr('adminCommon.save')}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        {!nouveau && <button type="button" className="btn-ghost" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={() => setConfirmer(true)}>{tr('adminCommon.delete')}</button>}
      </>}>
      <div className="fin-form-grid">
        <div className="field wide"><label htmlFor={ids + '-libelle'}>{tr('adminRentabilite.colLibelle')}</label><input id={ids + '-libelle'} value={f.libelle} onChange={set('libelle')} maxLength={200} /></div>
        <div className="field"><label htmlFor={ids + '-cat'}>{tr('adminRentabilite.colCategorie')}</label>
          <select id={ids + '-cat'} value={f.categorie} onChange={set('categorie')}>{(fixe ? CATEGORIES_FIXES : CATEGORIES_DEPART).map((c) => <option key={c} value={c}>{tr(`adminRentabilite.cat_${c}`)}</option>)}</select>
        </div>
        <div className="field"><label htmlFor={ids + '-montant'}>{tr('adminRentabilite.colMontant')}</label><input id={ids + '-montant'} type="number" min="0" step="0.01" inputMode="decimal" value={f.montant} onChange={set('montant')} /></div>
        {fixe && <>
          <div className="field"><label htmlFor={ids + '-per'}>{tr('adminRentabilite.colPeriodicite')}</label>
            <select id={ids + '-per'} value={f.periodicite} onChange={set('periodicite')}>{PERIODICITES.map((p) => <option key={p} value={p}>{tr(`adminRentabilite.per_${p}`)}</option>)}</select>
          </div>
          <div className="field"><label htmlFor={ids + '-debut'}>{tr('adminRentabilite.colDebut')}</label><input id={ids + '-debut'} type="date" value={f.debut} onChange={set('debut')} /></div>
          <div className="field"><label htmlFor={ids + '-fin'}>{tr('adminRentabilite.colFin')}</label><input id={ids + '-fin'} type="date" value={f.fin} onChange={set('fin')} /><span className="small" style={{ opacity: 0.75 }}>{tr('adminRentabilite.finAide')}</span></div>
        </>}
        {!fixe && <div className="field"><label htmlFor={ids + '-date'}>{tr('adminRentabilite.colDate')}</label><input id={ids + '-date'} type="date" value={f.date} onChange={set('date')} /></div>}
        <div className="field wide"><label htmlFor={ids + '-note'}>{tr('adminRentabilite.colNote')}</label><textarea id={ids + '-note'} rows={2} value={f.note} onChange={set('note')} style={{ width: '100%' }} /></div>
      </div>
      <ConfirmDialog open={confirmer} title={tr('adminRentabilite.confirmerSuppression', { libelle: cout.libelle || '' })} message={tr('adminCommon.irreversible')} danger loading={occupe} onConfirm={supprimer} onCancel={() => setConfirmer(false)} confirmLabel={tr('adminCommon.delete')} />
    </RecordDrawer>,
    document.body
  );
}
