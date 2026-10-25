import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import AdminDataTable, { useTableSort, sortRows } from '../../components/admin/AdminDataTable';
import { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import { ErrorCard, LoadMore, ResultCount } from '../../components/admin/AdminListTools';
import useServerList from '../../hooks/useServerList';
import { useAuth } from '../../context/AuthContext';
import useRechercheImposee from '../../hooks/useRechercheImposee';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import DecisionDialog from '../../components/admin/DecisionDialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReasonDialog from '../../components/admin/ReasonDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import ChangementTvaGlobal from '../../components/admin/ChangementTvaGlobal';
import LienValidationCarte from '../../components/admin/LienValidationCarte';
import VerificationAfsca from '../../components/admin/VerificationAfsca';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTicketButton from '../../components/admin/CreateTicketButton';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import { UploadDocumentModal } from './AdminDocumentsPage';
import { estCompteTest, estCompteSupprime, TestBadge, TestToggleButton, money, fmtDate, pct, downloadCsv, useDebouncedValue, NatureChips, BUSINESS_STATUS_LABELS, INVOICE_STATUS_LABELS, DOCUMENT_TYPE_LABELS, DOCUMENT_EXPIRY_LABELS, ORDER_STATUS_LABELS } from './adminUtils';
import { REFUND_RESPONSIBILITY_LABELS, SUBSCRIPTION_STATUS_LABELS, DELIVERY_MODE_LABELS, libelle } from './libellesCodes';
import { useLanguage } from '../../context/LanguageContext';
import useEtatPage from '../../hooks/useEtatPage';
import ouvrirDocument from '../../ouvrirDocument';
import { cheminFiche } from '../../adresseFiche';
import Icone from '../../components/Icone';

const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const PAGE_SIZE = 100;
// Restaurant test : de démonstration (restaurants.is_demo, créés par les seeds) ou tenu par un compte QA (+qa).
// Les autres sont de vraies inscriptions : visibles des clients seulement une fois publiées (publicListed).
const estTest = (r) => !!r.isDemo || estCompteTest(r);
function natureOkResto(nature, r) {
  if (nature === 'all') return true;
  if (nature === 'deleted') return estCompteSupprime(r);
  if (nature === 'test') return estTest(r) && !estCompteSupprime(r);
  return !estTest(r) && !estCompteSupprime(r);
}

const STATUT_ADMIN = (tr) => ({ pending: tr('adminRestos.filterPending'), approved: tr('adminRestos.filterApproved'), blocked: tr('adminRestos.filterBlocked') });

// Coordonnées d'un commerce pour l'admin : adresse complète, téléphone du commerce (lien d'appel) et, s'il
// diffère, celui du gérant. Un commerce sans numéro propre affiche le numéro du compte : on peut toujours appeler.
function ContactCommerce({ r, tr, fiche = false }) {
  const stop = (e) => e.stopPropagation();
  const tel = (n) => <a href={`tel:${String(n).replace(/[^+\d]/g, '')}`} onClick={stop} style={{ fontWeight: 600 }}>{n}</a>;
  const style = { margin: '2px 0' };
  return (
    <>
      <p className="small" style={style}><Icone nom="position" taille={16} className="icone-texte" />{' '}{r.fullAddress || '-'}</p>
      <p className="small" style={style}>
        <Icone nom="telephone" taille={16} className="icone-texte" />{' '}{r.restaurantPhone ? tel(r.restaurantPhone) : <span style={{ opacity: 0.7 }}>{tr('adminRestos.noRestoPhone')}</span>}{r.restaurantPhone && r.restaurantPhonePublic === false && <span className="small" style={{ opacity: 0.7 }}> ({tr('adminRestos.phoneHiddenPublic')})</span>}
        {r.restaurantPhoneSecondary && <> · {tel(r.restaurantPhoneSecondary)}{r.restaurantPhoneSecondaryPublic === false && <span className="small" style={{ opacity: 0.7 }}> ({tr('adminRestos.phoneHiddenPublic')})</span>}</>}
        {r.ownerPhone && r.ownerPhone !== r.restaurantPhone && r.ownerPhone !== r.restaurantPhoneSecondary && <> · {tr('adminRestos.ownerPhoneShort')} {tel(r.ownerPhone)}</>}
      </p>
      {/* Patron(s) / responsable(s) saisis à l'inscription ou dans Mon commerce › Contact (restaurants.manager_contacts). */}
      {(r.managerContacts || []).length > 0 && (
        <p className="small" style={style}>
          <Icone nom="compte" taille={16} className="icone-texte" />{' '}{tr('adminRestos.managers')} {r.managerContacts.map((m, i) => <span key={m.phone}>{i > 0 && ' · '}{m.name || '-'}{m.role === 'owner' ? ` (${tr('adminRestos.managerOwner')})` : ''} {tel(m.phone)}</span>)}
        </p>
      )}
      {fiche && r.priceMarkupPercent > 0 && <p className="small" style={style}><Icone nom="tendance" taille={16} className="icone-texte" />{' '}{tr('adminRestos.priceMarkup', { p: r.priceMarkupPercent })}</p>}
      {fiche && (r.restaurantEmail || r.restaurantEmailSecondary) && (
        <p className="small" style={style}>
          <Icone nom="courrier" taille={16} className="icone-texte" />{' '}{[r.restaurantEmail, r.restaurantEmailSecondary].filter(Boolean).map((e, i) => <span key={e}>{i > 0 && ' · '}<a href={`mailto:${e}`} onClick={stop}>{e}</a></span>)}
        </p>
      )}
    </>
  );
}

// « Fairide s'en occupe » : ouvre le tableau de bord du commerce comme le restaurateur, dans un nouvel onglet
// (POST /admin/restaurants/:id/act-as → jeton 8 h). Même bouton dans la fiche et dans la page Carte.
export function BoutonGererCommerce({ id, token, api, toast, tr, className = 'btn-teal', style }) {
  const [busy, setBusy] = useState(false);
  async function ouvrir() {
    setBusy(true);
    try {
      const d = await api(`/admin/restaurants/${id}/act-as`, { method: 'POST', token });
      const frag = btoa(encodeURIComponent(JSON.stringify({ token: d.token, user: d.user })));
      const w = window.open(`/dashboard#agir=${frag}`, '_blank');
      if (!w) toast(tr('adminRestos.manageBlocked'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  return <button type="button" className={className} style={style} disabled={busy} onClick={ouvrir} title={tr('adminRestos.manageHelp')}>{busy ? '…' : `${tr('adminRestos.manage')}`}</button>;
}

// « Fermer jusqu'à demain » (décision DEC-15) : pour un commerce fermé sans prévenir et injoignable. Il reste visible,
// affiché fermé, ne prend plus de commande et rouvre tout seul le lendemain à 6 h — sans le retirer du site.
export function BoutonFermerSoir({ detail, token, api, toast, tr, onChanged }) {
  const [busy, setBusy] = useState(false);
  const ferme = !!detail.pausedUntil && detail.pausedUntil > Date.now();
  async function basculer() {
    setBusy(true);
    try {
      await api(`/admin/restaurants/${detail.id}/close-until-tomorrow`, { method: 'PATCH', token, body: ferme ? { reopen: true } : {} });
      toast(ferme ? tr('adminRestos.reopenedToast') : tr('adminRestos.closedTonightToast'));
      onChanged?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  const heure = ferme ? new Date(detail.pausedUntil).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  return <button type="button" className="btn-outline" disabled={busy} onClick={basculer} title={tr('adminRestos.closeTonightHelp')}>{busy ? '…' : ferme ? tr('adminRestos.reopenNow', { time: heure }) : tr('adminRestos.closeTonight')}</button>;
}

// Abonnement offert ou facturé (fondateur, 7 oct. 2026) : offert à tous pendant le lancement, facturé commerce par commerce
// quand il commence à profiter de Fairide. Activer la facturation lui demande de souscrire (premier mois offert) ; le geste
// passe par une confirmation. Le retour à « offert » aussi (audit du 19/10, admin-06) : un commerce déjà abonné voit son
// abonnement Stripe résilié par le serveur (plus aucun prélèvement, rien de remboursé), et la confirmation le dit.
const ABONNEMENT_STRIPE_VIVANT = ['trialing', 'active', 'past_due', 'paused'];
export function BoutonFacturationAbonnement({ detail, token, api, toast, tr, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const facture = !!detail.subscriptionBillingEnabled;
  const abonne = ABONNEMENT_STRIPE_VIVANT.includes(detail.subscriptionStatus);
  async function basculer() {
    setConfirmer(false);
    setBusy(true);
    try {
      const rep = await api(`/admin/restaurants/${detail.id}/subscription-billing`, { method: 'PATCH', token, body: { enabled: !facture } });
      toast(facture ? tr(rep?.stripeSubscriptionCanceled ? 'adminRestos.subBillingOffCanceledToast' : 'adminRestos.subBillingOffToast') : tr(rep?.shopNotified ? 'adminRestos.subBillingOnNotifiedToast' : 'adminRestos.subBillingOnToast'));
      onChanged?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  return (
    <>
      <button type="button" className="btn-outline" disabled={busy} onClick={() => setConfirmer(true)} title={tr('adminRestos.subBillingHelp')}>{busy ? '…' : facture ? tr('adminRestos.subBillingOff') : tr('adminRestos.subBillingOn')}</button>
      <ConfirmDialog open={confirmer} title={facture ? tr('adminRestos.subBillingOff') : tr('adminRestos.subBillingOn')}
        message={facture ? tr(abonne ? 'adminRestos.subBillingOffConfirmStripe' : 'adminRestos.subBillingOffConfirm', { name: detail.name }) : tr('adminRestos.subBillingConfirmNotify', { name: detail.name })}
        loading={busy} onConfirm={basculer} onCancel={() => setConfirmer(false)} />
    </>
  );
}

// La colonne « Note » (tirée des avis, audit du 19/10, admin-65) est partie avec les avis clients (fondateur, 22/10/2026 :
// pas assez d'utilisateurs, des commerces avec peu d'étoiles feraient mauvaise impression ; on les refera peut-être plus
// tard). L'API n'envoie plus rating / reviewCount.
// « Prêt » ou « Manque : n » : la règle de la carte GO (pretLancement.js), commerce par commerce (admin-28).
function PastillePret({ pret, tr }) {
  const n = (pret.manques || []).filter((m) => m.niveau === 'bloquant').length;
  return <span className="pill" style={{ color: pret.pret ? 'var(--teal-deep)' : 'var(--orange)' }}>{pret.pret ? tr('adminRestos.readyPill') : tr('adminRestos.missingPill', { n })}</span>;
}
function PretLancement({ pret, tr }) {
  const bloquants = (pret.manques || []).filter((m) => m.niveau === 'bloquant');
  const aVerifier = (pret.manques || []).filter((m) => m.niveau !== 'bloquant');
  return (
    <div className="card" style={{ margin: '0 0 14px' }}>
      <h4 style={{ margin: '0 0 6px' }}>{pret.pret ? tr('adminRestos.readyTitle') : tr('adminRestos.missingTitle', { n: bloquants.length })}</h4>
      <p className="small" style={{ margin: '0 0 6px', opacity: 0.75 }}>{tr('adminRestos.readyHint')}</p>
      {bloquants.length > 0 && (
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          {bloquants.map((m) => <li key={m.label} style={{ marginBottom: 4, color: 'var(--red)' }}><b>{m.label}</b> <span style={{ opacity: 0.75 }}>{m.action}</span></li>)}
        </ul>
      )}
      {aVerifier.length > 0 && (
        <ul className="small" style={{ paddingLeft: 18, margin: '4px 0 0' }}>
          {aVerifier.map((m) => <li key={m.label} style={{ marginBottom: 4 }}>{m.label} <span style={{ opacity: 0.75 }}>{m.action}</span></li>)}
        </ul>
      )}
    </div>
  );
}

// État de la carte, d'après la carte elle-même (13 oct. 2026). Avant, la pastille venait de la demande « Fairide s'en
// occupe » : restée « en attente » après un import par script, elle affichait « Carte à intégrer » sur Le Laakam et ses 156
// plats, exactement comme sur Goodfellas qui n'en a aucun. Désormais : aucun plat → « Carte à importer » (demandée ou non
// par le commerce) ; des plats → l'état des prix (magasin vérifiés, ou à vérifier).
function PastilleCarte({ r, tr }) {
  if (r.menuItemCount === null || r.menuItemCount === undefined) return null;
  if (r.menuItemCount === 0) {
    return <span className="pill" style={{ color: 'var(--orange)' }}>{r.conciergeStatus ? tr('adminRestos.menuToImportRequestedPill') : tr('adminRestos.menuToImportPill')}</span>;
  }
  return <span className="pill" style={{ color: r.inStorePricesCheckedAt ? 'var(--iris)' : 'var(--orange)' }}>{r.inStorePricesCheckedAt ? tr('adminRestos.inStorePricesPill') : tr('adminRestos.platformPricesPill')}</span>;
}

// Prix relevés en magasin, ou présumés d'une plateforme (prixMagasin.js côté serveur, 13 oct. 2026). Les cartes importées
// d'Uber Eats portent des prix gonflés pour absorber leur commission ; seules les cartes relevées au comptoir sont marquées.
// Une carte marquée propose au commerce, sur sa page « C'est bon », de garder ses prix ou d'ajouter la commission de Fairide.
export function PrixMagasin({ detail, token, api, toast, tr, onChanged }) {
  const [busy, setBusy] = useState(false);
  // Un tap marquait une carte d'Uber Eats « prix magasin » : sa page « C'est bon » proposait alors +10 % sur des prix déjà
  // gonflés. Confirmation d'abord, qui dit l'effet (audit du 19/10, admin-64).
  const [confirmer, setConfirmer] = useState(false);
  const verifies = !!detail.inStorePricesCheckedAt;
  async function basculer() {
    setConfirmer(false);
    setBusy(true);
    try {
      await api(`/admin/restaurants/${detail.id}/in-store-prices`, { method: 'PATCH', token, body: { checked: !verifies } });
      toast(verifies ? tr('adminRestos.platformPricesLine') : tr('adminRestos.inStorePricesLine', { date: fmtDate(Date.now()) }));
      onChanged?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  const choix = { added: tr('adminRestos.fairideRateAdded'), kept: tr('adminRestos.fairideRateKept') }[detail.fairideRateChoice] || tr('adminRestos.fairideRatePending');
  return (
    <div style={{ marginTop: 8 }}>
      <p className="small" style={{ margin: 0 }}>{verifies ? tr('adminRestos.inStorePricesLine', { date: fmtDate(detail.inStorePricesCheckedAt) }) : tr('adminRestos.platformPricesLine')}</p>
      {verifies && <p className="small" style={{ margin: '2px 0 0' }}>{choix}</p>}
      <button type="button" className="btn-outline" style={{ marginTop: 6, padding: '6px 14px', fontSize: 13 }} disabled={busy} onClick={() => setConfirmer(true)}>
        {busy ? '…' : verifies ? tr('adminRestos.inStorePricesUnmark') : tr('adminRestos.inStorePricesMark')}
      </button>
      <ConfirmDialog open={confirmer} title={verifies ? tr('adminRestos.inStorePricesUnmark') : tr('adminRestos.inStorePricesMark')}
        message={verifies ? `${tr('adminRestos.inStoreUnmarkConfirm')}${detail.fairideRateChoice === 'added' ? ` ${tr('adminRestos.inStoreUnmarkAddedWarn')}` : ''}` : tr('adminRestos.inStoreMarkConfirm', { name: detail.name })}
        loading={busy} onConfirm={basculer} onCancel={() => setConfirmer(false)} />
    </div>
  );
}

export default function AdminRestaurantsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useEtatPage('recherche', location.state?.presetSearch || searchParams.get('q') || '', { forcer: !!(location.state?.presetSearch || searchParams.get('q') || '') });
  useRechercheImposee(setSearch);
  const q = useDebouncedValue(search, 350);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [orders, setOrders] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [retrait, setRetrait] = useState(null); // « Retirer du site » en attente de son motif (shop-13)
  const [decision, setDecision] = useState(null); // suspension / résiliation motivée (D6)
  // Validation refusée pour non-conformité : { id, conformite } tant que l'équipe n'a pas tranché.
  const [derogation, setDerogation] = useState(null);
  const [refusNet, setRefusNet] = useState(null); // validation refusée sans dérogation possible : ce qu'il faut corriger (admin-66)
  const [demandeInfo, setDemandeInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useViewMode('restaurants', 'cards');
  const filtre = searchParams.get('status') || 'all'; // all | pending | carte | approved | blocked
  // ?nature=real (liens des pastilles « à valider ») : la liste montre le même nombre que la pastille (admin-62).
  const [nature, setNature] = useEtatPage('nature', searchParams.get('nature') || 'all', { forcer: !!searchParams.get('nature') }); // all | real | test | deleted
  const [groupBy, setGroupBy] = useEtatPage('groupBy', '');
  // Allègement de la console (fondateur, 23/09/2026) : plus de listes « toutes les communes / toutes les
  // cuisines / trier par » — personne ne s'en servait, la recherche et les pastilles suffisent. La liste
  // reste servie des plus récents aux plus anciens ; en vue tableau, les en-têtes de colonne trient.
  const triServeur = 'created_desc';
  const { sort, toggle } = useTableSort('revenue');
  const setFiltre = (k) => { const next = Object.fromEntries([...searchParams.entries()]); if (k && k !== 'all') next.status = k; else delete next.status; setSearchParams(next); };

  // Recherche, tri et statut admin sont faits par le serveur ; nature et « carte » affinent les lignes chargées.
  const liste = useServerList('/admin/restaurants', { q, sort: triServeur, pageSize: PAGE_SIZE, extra: { adminStatus: ['pending', 'approved', 'blocked'].includes(filtre) ? filtre : '', menu: filtre === 'carte' ? 'a_importer' : '' } });
  const { rows: restaurants, setRows: setRestaurants, total, loading, error, reload: load, loadMore } = liste;
  // Compteurs de TOUTE la base (GET /admin/restaurants/stats). Ils étaient calculés sur les lignes
  // chargées, donc sur le sous-ensemble déjà filtré : en filtrant « à valider », « vrais comptes »
  // ne comptait plus que les vrais comptes parmi ceux à valider. Un compteur qui change de sens selon
  // le filtre ne veut plus rien dire. Si la route n'est pas disponible, on retombe sur l'ancien calcul.
  const [stats, setStats] = useState(null);
  const chargerStats = useCallback(() => {
    api('/admin/restaurants/stats', { token }).then(setStats).catch(() => setStats(null));
  }, [token]);
  useEffect(() => { chargerStats(); }, [chargerStats]);
  // PRÊT / MANQUE (audit du 19/10, admin-28) : la carte GO disait « 3 commerces prêts sur 11 » sans dire lesquels. Même liste
  // que la carte GO (pretLancement.js), par commerce : pastille sur la carte, détail dans la fiche.
  const [pretParId, setPretParId] = useState({});
  const chargerPret = useCallback(() => {
    api('/admin/launch/readiness', { token }).then((r) => setPretParId(Object.fromEntries((r.commerces || []).map((c) => [c.restaurantId, c])))).catch(() => setPretParId({}));
  }, [token]);
  useEffect(() => { chargerPret(); }, [chargerPret]);

  function openRestaurant(r) {
    setSelected(r);
    setDetail(null);
    setOrders(null);
    api(`/admin/restaurants/${r.id}`, { token }).then(setDetail).catch((e) => toast(e.message, 'erreur'));
    // 50 commandes (au lieu de 20) : l'onglet « Commandes » du commerce sert à les REGARDER, pas seulement à montrer
    // les dernières ; au-delà, « Tout voir » ouvre le module Commandes filtré sur ce commerce.
    api(`/admin/orders?restaurantId=${r.id}&limit=50`, { token }).then((res) => setOrders({ rows: res.rows, total: res.total })).catch((e) => toast(e.message, 'erreur'));
  }

  // Ordre dans la bannière de la page d'accueil : 1 = premier, vide = tiré au sort avec les autres vrais commerces.
  async function setLandingRank(id, rank) {
    try {
      const r = await api(`/admin/restaurants/${id}/landing`, { method: 'PATCH', token, body: { rank: rank === '' ? null : Number(rank) } });
      setRestaurants((prev) => (prev || []).map((x) => (x.id === id ? { ...x, landingRank: r.landingRank } : x)));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, landingRank: r.landingRank }));
      toast(r.landingRank ? tr('adminRestos.landingRankToast', { n: r.landingRank }) : tr('adminRestos.landingRankCleared'));
    } catch (e) { toast(e.message); }
  }
  // Livraison Fairide indisponible dans la zone (fondateur, 2026-10-08) : commerce seul, pas de livreur à proximité.
  async function setFairideDelivery(id, disabled, reason) {
    try {
      const res = await api(`/admin/restaurants/${id}/fairide-delivery`, { method: 'PATCH', token, body: { disabled, reason } });
      const maj = { fairideDeliveryDisabled: res.fairideDeliveryDisabled, fairideDeliveryDisabledReason: res.fairideDeliveryDisabledReason };
      setRestaurants((prev) => (prev || []).map((r) => (r.id === id ? { ...r, ...maj } : r)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, ...maj }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, ...maj }));
      toast(disabled ? tr('adminRestos.zoneDeliveryOffToast') : tr('adminRestos.zoneDeliveryOnToast'));
    } catch (e) { toast(e.message, 'erreur'); }
  }
  // Le commerce est prévenu par e-mail à chaque bascule : une confirmation d'abord, et runConfirmed bloque le second tap.
  function askZoneDelivery(id, disabled, reason, name) {
    setConfirmAction({ title: disabled ? tr('adminRestos.zoneDeliveryOff') : tr('adminRestos.zoneDeliveryOn'), message: tr(disabled ? 'adminRestos.zoneDeliveryOffConfirm' : 'adminRestos.zoneDeliveryOnConfirm', { name: name || '' }), danger: disabled, run: () => setFairideDelivery(id, disabled, reason) });
  }
  async function setListing(id, publicListed, reason) {
    try {
      await api(`/admin/restaurants/${id}/listing`, { method: 'PATCH', token, body: { publicListed, ...(reason ? { reason } : {}) } });
      setRestaurants((prev) => (prev || []).map((r) => (r.id === id ? { ...r, publicListed } : r)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, publicListed }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, publicListed }));
      toast(publicListed ? tr('adminRestos.publishedToast') : tr('adminRestos.unpublishedToast'));
      chargerStats();
    } catch (e) { toast(e.message, 'erreur'); }
  }

  /* Validation d'un commerce : le serveur refuse désormais en 409 si des exigences réglementaires
     bloquantes manquent (AFSCA, RC exploitation, licence alcool, BCE valide — voir
     conformiteCommerce.js). Le refus n'est pas définitif : il ouvre un dialogue qui montre CE qui
     manque et demande un motif pour passer outre, motif journalisé sur la fiche.
     On n'empêche pas l'équipe de valider — on l'empêche de valider sans savoir. */
  // `decision` : faits, base contractuelle, mesure — exigés pour une suspension (D6, voir DecisionDialog).
  async function setStatus(id, status, { force = false, reason = '', decision = {} } = {}) {
    try {
      const rep = await api(`/admin/restaurants/${id}/status`, { method: 'PATCH', token, body: { status, ...(force ? { force: true, reason } : {}), ...decision } });
      // Résiliation avec préavis : décidée et notifiée, mais le commerce reste actif jusqu'à la date d'effet.
      if (status === 'blocked' && !rep.adminStatus) { toast(tr('conformite.decisionScheduledToast')); return; }
      // Approuvé ET mis en ligne par le serveur (une seule validation) : la ligne le dit tout de suite, sans recharger.
      const maj = { adminStatus: status, ...(rep.publicListed ? { publicListed: true } : {}) };
      setRestaurants((prev) => (prev || []).map((r) => (r.id === id ? { ...r, ...maj } : r)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, ...maj }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, ...maj }));
      if (status === 'approved') toast(rep.publicListed ? tr('adminRestos.toastApprovedOnline') : rep.notOnlineReason ? tr('adminRestos.toastApprovedNotOnline', { reason: rep.notOnlineReason }) : tr('adminRestos.toastApproved'));
      else toast(status === 'blocked' ? tr('adminRestos.toastSuspended') : tr('adminCommon.toastStatusUpdated'));
      chargerStats(); chargerPret();
    } catch (e) {
      if (e.code === 'CONFORMITE_INCOMPLETE' && e.data?.conformite) {
        setDerogation({ id, conformite: e.data.conformite });
        return;
      }
      // Refus sans dérogation possible : la liste de ce qu'il faut corriger, au lieu d'un toast muet (audit du 19/10, admin-66).
      if (['CONFORMITE_NON_FORCABLE', 'SECOND_ADMIN_REQUIS'].includes(e.code) && e.data?.conformite) {
        const manques = (e.data.conformite.anomalies || []).filter((a) => a.niveau === 'bloquant' && (e.code !== 'SECOND_ADMIN_REQUIS' || a.escalade || a.forcable === false));
        setRefusNet({ message: e.message, manques: (manques.length ? manques : (e.data.conformite.anomalies || []).filter((a) => a.niveau === 'bloquant')).map((a) => a.label) });
        return;
      }
      toast(e.message, 'erreur');
    }
  }

  // Terminal Fairide : chaque étape (remise, caution, retour, remboursement) passe par une confirmation, comme le
  // sac des livreurs (AdminCouriersPage). Le serveur pose les dates et journalise.
  async function setTerminal(id, status) {
    try {
      const r = await api(`/admin/restaurants/${id}/terminal`, { method: 'PATCH', token, body: { status } });
      if (detail?.id === id) setDetail((prev) => ({ ...prev, terminal: r.terminal }));
      setRestaurants((prev) => (prev || []).map((x) => (x.id === id ? { ...x, terminal: r.terminal } : x)));
      toast(tr('adminRestos.terminalToast'));
    } catch (e) { toast(e.message, 'erreur'); }
  }
  function askTerminal(r, status, cle) {
    const amount = Number(r.terminal?.depositAmount || 80).toFixed(0);
    setConfirmAction({ title: tr(`adminRestos.${cle}`), message: tr(`adminRestos.${cle}Body`, { name: r.name, amount }), danger: status === 'conserve', run: () => setTerminal(r.id, status) });
  }

  // Toute action qui change ce que voient les clients (publication, approbation) ou bloque un commerce
  // passe par une confirmation, comme partout dans l'ERP.
  function askSuspend(r) {
    setDecision({ id: r.id, name: r.name });
  }
  function askReactivate(r) {
    setConfirmAction({ title: tr('adminRestos.confirmReactivate', { name: r.name }), run: () => setStatus(r.id, 'approved') });
  }
  function askApprove(r) {
    setConfirmAction({ title: tr('adminRestos.confirmApprove', { name: r.name }), message: `${tr('adminRestos.approveBody')} ${tr('adminRestos.approveBodyOneStep')}`, run: () => setStatus(r.id, 'approved') });
  }
  function askListing(r) {
    const publier = !r.publicListed;
    // Retirer du site : motif obligatoire, envoyé au commerce et montré sur son tableau de bord (audit du 19/10, shop-13 ;
    // P2B art. 4). Le serveur le refuse sans motif (MOTIF_REQUIS).
    if (!publier && !r.isDemo) { setRetrait({ id: r.id, name: r.name }); return; }
    setConfirmAction({ title: publier ? tr('adminRestos.confirmPublish', { name: r.name }) : tr('adminRestos.confirmUnpublish', { name: r.name }), message: publier ? tr('adminRestos.publishBody') : tr('adminRestos.unpublishBody'), danger: !publier, run: () => setListing(r.id, publier) });
  }
  async function deleteRestaurant(r) {
    const res = await api(`/admin/restaurants/${r.id}`, { method: 'DELETE', token, body: { deleteOwner: true } });
    setRestaurants((prev) => (prev || []).filter((x) => x.id !== r.id));
    if (selected?.id === r.id) { setSelected(null); setDetail(null); }
    toast(res.ownerDeleted ? tr('adminRestos.toastDeletedWithOwner', { n: res.deletedOrders, email: res.ownerEmail || '' }) : res.restaurantKept === false ? tr('adminRestos.toastDeletedFully') : tr('adminRestos.toastDeleted', { n: res.deletedOrders }));
  }
  function askDelete(r) {
    setConfirmAction({ title: tr('adminRestos.confirmDelete', { name: r.name }), message: tr('adminRestos.deleteBodyKept', { name: r.name, email: r.ownerEmail || '' }), danger: true, run: () => deleteRestaurant(r).catch((e) => toast(e.message, 'erreur')) });
  }

  async function runConfirmed() {
    if (!confirmAction) return;
    setBusy(true);
    try { await confirmAction.run(); } finally { setBusy(false); setConfirmAction(null); }
  }

  function refreshDetail() {
    if (selected) api(`/admin/restaurants/${selected.id}`, { token }).then(setDetail).catch((e) => toast(e.message, 'erreur'));
  }

  function exportCsv() {
    if (!visibles.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`restaurants-${Date.now()}.csv`, visibles, [
      { label: tr('adminCommon.name'), get: (r) => r.name },
      { label: tr('adminCommon.commune'), get: (r) => r.commune },
      { label: tr('adminCommon.cuisine'), get: (r) => r.cuisine },
      { label: tr('adminCommon.status'), get: (r) => r.businessStatus },
      { label: tr('adminCommon.owner'), get: (r) => r.responsibleName },
      { label: tr('adminCommon.email'), get: (r) => r.ownerEmail },
      { label: tr('adminRestos.restoPhone'), get: (r) => r.restaurantPhone },
      { label: tr('adminRestos.ownerPhoneCol'), get: (r) => r.ownerPhone },
      { label: tr('adminRestos.addressCol'), get: (r) => r.fullAddress },
      { label: tr('adminRestos.companyNumber'), get: (r) => r.companyNumber },
      { label: tr('adminCommon.vat'), get: (r) => r.vatNumber },
      { label: tr('adminCommon.orders'), get: (r) => r.orderCount },
      { label: 'CA', get: (r) => r.revenue },
      { label: tr('adminRestos.commissionGenerated'), get: (r) => r.commissionGenerated },
      { label: tr('adminCommon.avgBasket'), get: (r) => r.avgBasket },
      { label: tr('adminCommon.cancellationRate'), get: (r) => r.cancellationRate },
      { label: tr('adminRestos.acceptanceRate'), get: (r) => r.acceptanceRate },
      { label: tr('adminRestos.colAvgPrep'), get: (r) => r.avgPrepMinutes }
    ]);
  }

  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (r) => <><b>{r.name}</b>{estTest(r) && <TestBadge />}</>, sortValue: (r) => r.name },
    { key: 'listing', label: tr('adminRestos.listingCol'), get: (r) => (estTest(r) ? <span className="small">{r.isDemo ? tr('adminRestos.alwaysListed') : tr('adminRestos.neverListedTest')}</span> : <span className={`pill ${r.publicListed ? 'listing-on' : 'listing-off'}`}>{r.publicListed ? tr('adminRestos.listedPill') : tr('adminRestos.unlistedPill')}</span>), sortValue: (r) => (estTest(r) ? 2 : r.publicListed ? 1 : 0) },
    { key: 'commune', label: tr('adminCommon.commune'), get: (r) => r.commune },
    { key: 'cuisine', label: tr('adminCommon.cuisine'), get: (r) => r.cuisine },
    { key: 'phone', label: tr('adminCommon.phone'), get: (r) => (r.restaurantPhone || r.ownerPhone ? <a href={`tel:${String(r.restaurantPhone || r.ownerPhone).replace(/[^+\d]/g, '')}`} onClick={(e) => e.stopPropagation()}>{r.restaurantPhone || r.ownerPhone}</a> : '-'), sortValue: (r) => r.restaurantPhone || r.ownerPhone || '' },
    { key: 'fullAddress', label: tr('adminRestos.addressCol'), get: (r) => r.fullAddress || '-', sortValue: (r) => r.fullAddress || '' },
    { key: 'businessStatus', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: BUSINESS_STATUS_LABELS[r.businessStatus]?.color }}>{BUSINESS_STATUS_LABELS[r.businessStatus]?.label}</span>, sortValue: (r) => r.businessStatus },
    { key: 'orderCount', label: tr('adminCommon.orders'), get: (r) => r.orderCount, align: 'right', sum: true },
    { key: 'revenue', label: 'CA', get: (r) => money(r.revenue), sortValue: (r) => r.revenue, align: 'right', sum: true },
    { key: 'commissionGenerated', label: tr('adminCommon.commission'), get: (r) => money(r.commissionGenerated), sortValue: (r) => r.commissionGenerated, align: 'right', sum: true },
    { key: 'avgBasket', label: tr('adminCommon.avgBasket'), get: (r) => money(r.avgBasket), sortValue: (r) => r.avgBasket, align: 'right' },
    { key: 'cancellationRate', label: tr('adminCommon.cancellationRate'), get: (r) => pct(r.cancellationRate), sortValue: (r) => r.cancellationRate, align: 'right' },
    { key: 'createdAt', label: tr('adminCommon.registeredOn'), get: (r) => fmtDate(r.createdAt), sortValue: (r) => r.createdAt }
  ];
  const groupes = {
    commune: { get: (r) => r.commune || '-' }, cuisine: { get: (r) => r.cuisine || '-' },
    status: { get: (r) => STATUT_ADMIN(tr)[r.adminStatus] || r.adminStatus }, business: { get: (r) => BUSINESS_STATUS_LABELS[r.businessStatus]?.label || r.businessStatus }
  };
  const visibles = useMemo(() => sortRows((restaurants || []).filter((r) => (filtre !== 'carte' || r.menuItemCount === 0) && natureOkResto(nature, r)), colonnes, sort), [restaurants, filtre, nature, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => (restaurants || []).reduce((a, r) => ({ pending: a.pending + (r.adminStatus === 'pending' ? 1 : 0), carte: a.carte + (r.menuItemCount === 0 && !estTest(r) ? 1 : 0), real: a.real + (estTest(r) || estCompteSupprime(r) ? 0 : 1), deleted: a.deleted + (estCompteSupprime(r) ? 1 : 0), unlisted: a.unlisted + (!estTest(r) && !r.publicListed ? 1 : 0), orders: a.orders + r.orderCount, revenue: a.revenue + r.revenue, commission: a.commission + r.commissionGenerated }), { pending: 0, carte: 0, real: 0, deleted: 0, unlisted: 0, orders: 0, revenue: 0, commission: 0 }), [restaurants]);
  // Chiffres affichés en tête et sur les pastilles : ceux du serveur (toute la base) dès qu'ils sont
  // là, sinon ceux des lignes chargées — pour que la page reste lisible même sans la route.
  const chiffres = stats
    ? { pending: stats.pending, real: stats.real, deleted: stats.deleted, orders: stats.orders, revenue: stats.revenue, commission: stats.commission }
    : kpi;
  const compteurStatut = (k) => {
    if (!stats) return k === 'pending' && kpi.pending > 0 ? ` (${kpi.pending})` : k === 'carte' && kpi.carte > 0 ? ` (${kpi.carte})` : '';
    const n = { all: stats.total, pending: nature === 'real' && Number.isFinite(stats.pendingReal) ? stats.pendingReal : stats.pending, carte: stats.menuToImport ?? stats.menuRequests, approved: stats.approved, blocked: stats.blocked }[k];
    return Number.isFinite(n) ? ` (${n})` : '';
  };
  const tousCharges = restaurants && restaurants.length >= total;

  return (
    <div>
      <AdminPageHeader module="restaurants" actions={<><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>} />
      <ChangementTvaGlobal token={token} toast={toast} />
      {restaurants && (
        <div className="stat-grid">
          <div className="stat-card highlight"><div className="num">{stats ? stats.total : total}</div><div className="label">{tr('adminRestos.kpiTotal')}</div></div>
          <div className="stat-card"><div className="num" style={{ color: chiffres.pending > 0 ? 'var(--gold-deep)' : undefined }}>{chiffres.pending}</div><div className="label">{tr('adminRestos.kpiPending')}</div></div>
          <div className="stat-card"><div className="num">{chiffres.real}</div><div className="label">{tr('adminRestos.kpiReal')}</div></div>
          <div className="stat-card"><div className="num">{chiffres.orders}</div><div className="label">{tr('adminCommon.paidOrders')}</div></div>
          <div className="stat-card"><div className="num">{money(chiffres.revenue)}</div><div className="label">{tr('adminRestos.kpiRevenue')}</div></div>
          <div className="stat-card"><div className="num">{money(chiffres.commission)}</div><div className="label">{tr('adminRestos.kpiCommission')}</div></div>
        </div>
      )}
      {restaurants && !tousCharges && <p className="small" style={{ margin: '-8px 0 12px', opacity: 0.7 }}>{tr('adminCommon.kpiOnLoaded', { n: restaurants.length, total })}</p>}
      <div className="admin-control-panel">
        <input aria-label={tr('adminRestos.phSearch')} placeholder={tr('adminRestos.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {[['all', tr('adminCommon.allM')], ['pending', tr('adminRestos.filterPending')], ['carte', tr('adminRestos.filterMenuToImport')], ['approved', tr('adminRestos.filterApproved')], ['blocked', tr('adminRestos.filterBlocked')]].map(([k, l]) => (
            <div key={k} className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l}{compteurStatut(k)}</div>
          ))}
        </div>
        <NatureChips nature={nature} onChange={setNature} allCount={stats ? stats.total : undefined} realCount={chiffres.real} testCount={stats ? stats.test : undefined} deletedCount={chiffres.deleted} labels={{ all: tr('adminCommon.allM'), real: tr('adminRestos.filterReal'), test: tr('adminRestos.filterTest'), deleted: tr('adminCommon.filterDeletedAccounts') }} />
        {mode === 'table' && (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">{tr('adminCommon.noGroup')}</option>
            <option value="commune">{tr('adminCommon.groupBy')} : {tr('adminCommon.commune')}</option>
            <option value="cuisine">{tr('adminCommon.groupBy')} : {tr('adminCommon.cuisine')}</option>
            <option value="status">{tr('adminCommon.groupBy')} : {tr('adminCommon.status')}</option>
            <option value="business">{tr('adminCommon.groupBy')} : {tr('adminRestos.groupBusiness')}</option>
          </select>
        )}
        <ResultCount n={visibles.length} total={total} />
      </div>
      {restaurants && nature !== 'test' && <p className="small" style={{ margin: '-4px 0 12px' }}>{tr('adminRestos.listingHintOneStep')}</p>}
      {error && <ErrorCard message={error} onRetry={load} />}
      {!restaurants && !error && <SkeletonCards count={3} />}
      {restaurants && visibles.length === 0 && !error && <div className="empty">{tr('adminCommon.noResults')}</div>}
      {restaurants && mode === 'table' && visibles.length > 0 && (
        <AdminDataTable columns={colonnes} rows={visibles} sort={sort} onSort={toggle} groupBy={groupBy ? groupes[groupBy] : null} onRowClick={openRestaurant}
          rowClassName={(r) => (estTest(r) ? 'row-test-account' : '')} showTotals format={{ revenue: money, commissionGenerated: money }} emptyLabel={tr('adminCommon.noResults')} />
      )}
      {restaurants && mode === 'cards' && visibles.map((r) => {
        const biz = BUSINESS_STATUS_LABELS[r.businessStatus];
        return (
          <div className={`card order-card-clickable${estTest(r) ? ' card-test-account' : ''}`} key={r.id} onClick={() => openRestaurant(r)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{r.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {estTest(r) && <TestBadge />}
                {!estTest(r) && <span className={`pill ${r.publicListed ? 'listing-on' : 'listing-off'}`}>{r.publicListed ? tr('adminRestos.listedPill') : tr('adminRestos.unlistedPill')}</span>}
                <span className="pill" style={{ color: biz?.color }}>{biz?.label}</span>
                {!estTest(r) && <PastilleCarte r={r} tr={tr} />}
                {!estTest(r) && pretParId[r.id] && <PastillePret pret={pretParId[r.id]} tr={tr} />}
              </div>
            </div>
            <div className="small">{r.commune} · {r.cuisine}</div>
            <ContactCommerce r={r} tr={tr} />
            <div className="small">{tr('adminRestos.ownerLine', { name: r.responsibleName || '-', phone: r.ownerEmail ? ` · ${r.ownerEmail}` : '' })}</div>
            {r.menuItemCount !== null && r.menuItemCount !== undefined && <div className="small"><Icone nom="restaurants" taille={16} className="icone-texte" />{' '}{tr('adminRestos.menuLine', { n: r.menuItemCount })}</div>}
            {(r.companyNumber || r.vatNumber) && <div className="small">{tr('adminRestos.companyNumber')} {r.companyNumber || '-'} · TVA {r.vatNumber || '-'}</div>}
            <div className="small">
              {tr('adminRestos.statsLine', { n: r.orderCount, revenue: money(r.revenue), commission: money(r.commissionGenerated), basket: money(r.avgBasket) })}
            </div>
            <div className="small">
              {tr('adminRestos.ratesLine', { cancel: pct(r.cancellationRate), accept: pct(r.acceptanceRate), prep: r.avgPrepMinutes !== null ? tr('adminRestos.prepMinutes', { n: r.avgPrepMinutes }) : tr('adminRestos.prepNotMeasured') })}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
              <Link to={`/admin/restaurants/${r.id}/menu`} className={r.menuItemCount === 0 ? 'btn-gold' : 'btn-outline'} style={{ padding: '6px 14px', fontSize: 13, textDecoration: 'none' }}>{tr('adminRestos.openMenu')}</Link>
              {/* Publier n'a de sens qu'approuvé (le public ne voit que les commerces approuvés, admin-27) ; un commerce
                  suspendu se réactive, il ne s'« approuve » pas une seconde fois (admin-86). */}
              {!estTest(r) && (r.publicListed || r.adminStatus === 'approved') && <button className={r.publicListed ? 'btn-outline' : 'btn-gold'} style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askListing(r)}>{r.publicListed ? tr('adminRestos.unpublish') : tr('adminRestos.publish')}</button>}
              {r.adminStatus === 'pending' && <button className="btn-teal btn-sm" onClick={() => askApprove(r)}>{tr('adminCommon.approve')}</button>}
              {r.adminStatus !== 'approved' && r.ownerId && <button className="btn-outline btn-sm" onClick={() => setDemandeInfo(r)}>{tr('adminRestos.askInfo')}</button>}
              {r.adminStatus !== 'blocked' && <button className="btn-danger-ghost btn-sm" onClick={() => askSuspend(r)}>{tr('adminCommon.suspend')}</button>}
              {r.adminStatus === 'blocked' && <button className="btn-teal btn-sm" onClick={() => askReactivate(r)}>{tr('adminCommon.reactivate')}</button>}
              <button className="btn-danger-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => askDelete(r)}>{tr('adminRestos.deleteRestaurant')}</button>
            </div>
          </div>
        );
      })}
      {restaurants && <LoadMore loaded={restaurants.length} total={total} loading={loading} onMore={loadMore} />}

      {selected && (
        <RestaurantDetailModal
          selected={selected} detail={detail} orders={orders}
          onZoneDelivery={(id, disabled, reason) => askZoneDelivery(id, disabled, reason, detail?.name)}
          pret={pretParId[selected.id]}
          onClose={() => setSelected(null)}
          onSuspend={() => askSuspend(detail)}
          onApprove={() => askApprove(detail)}
          onToggleListing={() => askListing(detail)}
          onLandingRank={setLandingRank}
          onReactivate={() => askReactivate(detail)}
          onTerminal={(status, cle) => askTerminal(detail, status, cle)}
          onDelete={() => askDelete(detail)}
          onChanged={refreshDetail}
          onToggleTest={() => { refreshDetail(); load(); }}
        />
      )}
      <DecisionDialog open={!!decision} cible={decision?.name} targetType="restaurant" loading={busy}
        onCancel={() => setDecision(null)}
        onConfirm={async (payload) => { setBusy(true); try { await setStatus(decision.id, 'blocked', { decision: payload }); } finally { setBusy(false); setDecision(null); } }} />
      <ConfirmDialog
        open={!!refusNet}
        title={tr('adminRestos.refusalTitle')}
        message={refusNet ? `${refusNet.message} ${refusNet.manques.length ? tr('adminRestos.refusalList', { list: refusNet.manques.join(' · ') }) : ''}` : ''}
        confirmLabel={tr('adminRestos.refusalOk')}
        onConfirm={() => setRefusNet(null)}
        onCancel={() => setRefusNet(null)}
      />
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        danger={confirmAction?.danger}
        loading={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmAction(null)}
      />
      <ReasonDialog
        open={!!retrait}
        title={tr('adminRestos.confirmUnpublish', { name: retrait?.name || '' })}
        message={`${tr('adminRestos.unpublishBody')} ${tr('adminRestos.unpublishReasonHelp')}`}
        label={tr('adminRestos.unpublishReasonLabel')}
        placeholder={tr('adminRestos.unpublishReasonPh')}
        confirmLabel={tr('adminRestos.unpublish')}
        multiline danger
        loading={busy}
        onConfirm={async (motif) => {
          if (motif.length < 10) { toast(tr('adminRestos.unpublishReasonShort'), 'erreur'); return; }
          const r = retrait;
          setRetrait(null);
          setBusy(true);
          try { await setListing(r.id, false, motif); } finally { setBusy(false); }
        }}
        onCancel={() => setRetrait(null)}
      />
      {/* « DEMANDER UNE INFO » (fondateur, 18/10/2026) : le commerce attendait sans savoir pourquoi. Un message dans sa
          messagerie Fairide, et par e-mail (POST /admin/messages/threads) : ce qu'il manque, en clair. */}
      <ReasonDialog
        open={!!demandeInfo}
        title={tr('adminRestos.askInfoTitle', { name: demandeInfo?.name || '' })}
        message={tr('adminRestos.askInfoBody')}
        label={tr('adminRestos.askInfoLabel')}
        placeholder={tr('adminRestos.askInfoPh')}
        confirmLabel={tr('adminRestos.askInfoSend')}
        multiline
        loading={busy}
        onConfirm={async (texte) => {
          const r = demandeInfo;
          setDemandeInfo(null);
          try {
            await api('/admin/messages/threads', { method: 'POST', token, body: { userId: r.ownerId, subject: tr('adminRestos.askInfoSubject'), body: texte, notifyByEmail: true } });
            toast(tr('adminRestos.askInfoSent'), 'succes');
          } catch (e) { toast(e.message, 'erreur'); }
        }}
        onCancel={() => setDemandeInfo(null)}
      />
      {/* Dérogation : s'ouvre quand le serveur a refusé la validation faute de conformité. Liste
          d'abord ce qui manque, puis demande le motif — dans cet ordre, pour qu'on ne tape pas un
          motif sans avoir lu ce à quoi on déroge. */}
      <ReasonDialog
        open={!!derogation}
        title={tr('adminRestos.conformiteBlocTitle')}
        message={tr('adminRestos.conformiteBlocBody')}
        label={tr('adminRestos.conformiteMotif')}
        placeholder={tr('adminRestos.conformiteMotifPh')}
        confirmLabel={tr('adminRestos.conformiteForcer')}
        danger
        multiline
        loading={busy}
        onConfirm={async (motif) => {
          const d = derogation;
          setDerogation(null);
          await setStatus(d.id, 'approved', { force: true, reason: motif });
        }}
        onCancel={() => setDerogation(null)}
      >
        <ul className="small" style={{ margin: '0 0 12px', paddingLeft: 18 }}>
          {(derogation?.conformite?.anomalies || []).filter((a) => a.niveau === 'bloquant').map((a) => (
            <li key={a.cle} style={{ marginBottom: 6 }}>
              <b>{a.label}</b><br />
              <span style={{ opacity: 0.75 }}>{a.action}</span>
            </li>
          ))}
        </ul>
      </ReasonDialog>
    </div>
  );
}

// Panneau de conformité réglementaire d'un commerce, en tête de sa fiche.
//
// Placé AVANT les chiffres d'activité : un commerce qui n'a pas le droit de vendre de la nourriture
// est une information qui prime sur son panier moyen. Les relevés faits par l'équipe (code NACE,
// Food Hygiene Rating) se saisissent ici même — ils viennent de registres publics qu'on va lire, et
// un écran qui affiche le manque sans permettre de le combler renvoie la tâche à plus tard.
function ConformitePanel({ detail, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const idsA11y = useId();
  const [nace, setNace] = useState(detail.naceCode || '');
  const [score, setScore] = useState(detail.hygieneRating || '');
  const [busy, setBusy] = useState(false);
  const c = detail.conformite;
  if (!c) return null;

  async function enregistrer() {
    setBusy(true);
    try {
      await api(`/admin/restaurants/${detail.id}/conformite`, { method: 'PATCH', token, body: { naceCode: nace, hygieneRating: score } });
      toast(tr('adminRestos.conformiteSaved'));
      onChanged?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ margin: '0 0 14px', borderColor: c.conforme ? 'var(--line)' : 'var(--red)' }}>
      <h4 style={{ margin: '0 0 8px', color: c.conforme ? 'inherit' : 'var(--red)' }}>
        {c.conforme ? tr('adminRestos.conformiteOk') : tr('adminRestos.conformiteKo', { n: c.bloquantes })}
      </h4>
      {detail.complianceOverride && (
        <p className="small" style={{ color: 'var(--gold-deep)', marginTop: 0 }}>
          {tr('adminRestos.conformiteOverride', { email: detail.complianceOverride.by, date: fmtDate(detail.complianceOverride.at) })} — {detail.complianceOverride.reason}
        </p>
      )}
      {c.anomalies.length > 0 && (
        <ul className="small" style={{ paddingLeft: 18, marginTop: 0 }}>
          {c.anomalies.map((a) => (
            <li key={a.cle} style={{ marginBottom: 5, color: a.niveau === 'bloquant' ? 'var(--red)' : 'inherit' }}>
              <b>{a.label}</b> <span style={{ opacity: 0.75 }}>— {a.action}</span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
        <div className="field" style={{ margin: 0, flex: '1 1 140px' }}>
          <label htmlFor={`${idsA11y}-nace`}>{tr('adminRestos.naceCode')}</label>
          <input id={`${idsA11y}-nace`} value={nace} onChange={(e) => setNace(e.target.value)} placeholder="56.101" />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 140px' }}>
          <label htmlFor={`${idsA11y}-score`}>{tr('adminRestos.hygieneRating')}</label>
          <select id={`${idsA11y}-score`} value={score} onChange={(e) => setScore(e.target.value)}>
            <option value="">{tr('adminRestos.hygieneNotChecked')}</option>
            {['A', 'B', 'C', 'D'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn-outline" onClick={enregistrer} disabled={busy}>{busy ? '...' : tr('adminCommon.save')}</button>
      </div>
      <p className="small" style={{ opacity: 0.7, marginTop: 8, marginBottom: 0 }}>{tr('adminRestos.conformiteReleveHint')}</p>
      <VerificationAfsca detail={detail} onChanged={onChanged} />
    </div>
  );
}

// LES COMMANDES D'UN COMMERCE, AVEC LEUR DÉTAIL (fondateur, 16/10/2026 : « permets à l'admin de voir les commandes et
// détails pour chaque commerce »). L'onglet listait seulement date · client · total · statut ; on ouvre maintenant
// chaque commande sur place (GET /admin/orders/:id) : articles, montants et qui touche quoi, paiement, livreur, codes,
// remboursements et jalons. Rien de nouveau côté serveur — c'est la fiche de commande du module Commandes, rendue ici
// pour ne pas avoir à quitter le commerce.
function CommandesDuCommerce({ restaurantId, orders, token, tr, toast }) {
  const [ouvert, setOuvert] = useState(null); // id de la commande dépliée
  const [fiches, setFiches] = useState({}); // id -> détail (gardé en mémoire : rouvrir ne recharge pas)
  const rows = orders?.rows || null;

  function basculer(id) {
    if (ouvert === id) { setOuvert(null); return; }
    setOuvert(id);
    if (fiches[id]) return;
    api(`/admin/orders/${id}`, { token }).then((d) => setFiches((f) => ({ ...f, [id]: d }))).catch((e) => toast(e.message, 'erreur'));
  }
  const ligneMontant = (label, valeur, fort = false) => (
    <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{label}</span><span className="small">{fort ? <b>{valeur}</b> : valeur}</span></div>
  );

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminCommon.recentOrders')}{orders ? ` · ${orders.total}` : ''}</h4>
        <Link to={`/admin/orders?restaurantId=${restaurantId}`} className="small">{tr('adminRestos.seeAll')}</Link>
      </div>
      {!rows && <div className="small">{tr('adminCommon.loading')}</div>}
      {rows && rows.length === 0 && <div className="small">{tr('adminCommon.noOrdersYet')}</div>}
      {rows && rows.map((o) => {
        const d = fiches[o.id];
        const estOuverte = ouvert === o.id;
        return (
          <div key={o.id} className="drawer-order">
            <button type="button" className="drawer-row drawer-order-tete" onClick={() => basculer(o.id)} aria-expanded={estOuverte}>
              <span className="small">
                {estOuverte ? '▾' : '▸'} {fmtDate(o.createdAt)} · {o.clientName}
                {o.driverName ? tr('adminRestos.deliveredBySuffix', { name: o.driverName }) : ''}
                {o.paymentMode === 'on_site' ? ` · ${tr('adminRestos.orderOnSite')}` : ''}
                {o.isTraining ? ` · ${tr('adminRestos.orderTraining')}` : ''}
                {o.hasRefund ? ' · ↩︎' : ''}
              </span>
              <span className="row" style={{ gap: 8 }}><b className="small">{money(o.total)}</b><span className={`status-badge status-${o.status}`}>{libelle(ORDER_STATUS_LABELS, o.status)}</span></span>
            </button>
            {estOuverte && !d && <div className="small" style={{ padding: '4px 0 10px' }}>{tr('adminCommon.loading')}</div>}
            {estOuverte && d && (
              <div className="drawer-order-detail" style={{ padding: '6px 0 12px' }}>
                <div className="small" style={{ fontFamily: 'monospace', opacity: 0.7 }}>#{d.id.slice(0, 8)}</div>
                {d.items.map((it, i) => (
                  <div key={`${it.name}-${i}`} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="small">{it.qty} × {it.name}{it.discount ? ` (−${money(it.discount)})` : ''}</span>
                    <span className="small">{money(it.price * it.qty - (it.discount || 0))}</span>
                  </div>
                ))}
                <div className="divider" />
                {ligneMontant(tr('adminRestos.orderSubtotal'), money(d.subtotal))}
                {d.orderType === 'delivery' && ligneMontant(tr('adminRestos.orderDelivery'), money(d.deliveryFee))}
                {d.serviceFee > 0 && ligneMontant(tr('adminRestos.orderSystemFee'), money(d.serviceFee))}
                {d.promoDiscount > 0 && ligneMontant(tr('adminRestos.orderPromo', { label: d.promoLabel || '' }), `−${money(d.promoDiscount)}`)}
                {d.tipAmount > 0 && ligneMontant(tr('adminRestos.orderTip'), money(d.tipAmount))}
                {ligneMontant(tr('adminRestos.orderTotal'), money(d.total), true)}
                <div className="divider" />
                {ligneMontant(tr('adminRestos.orderCommission'), money(d.commission))}
                {ligneMontant(tr('adminRestos.orderRestaurantDue'), money(d.restaurantDue), true)}
                {d.orderType === 'delivery' && ligneMontant(tr('adminRestos.orderDriverDue'), money(d.driverDue))}
                <div className="divider" />
                <div className="small">{tr('adminRestos.orderPayment', { mode: d.paymentMode === 'on_site' ? tr('adminRestos.orderOnSite') : d.paymentMode === 'balance' ? tr('adminRestos.orderBalance') : tr('adminRestos.orderOnline'), paid: d.paid ? tr('adminRestos.orderPaid') : tr('adminRestos.orderUnpaid') })}</div>
                {d.address && <div className="small">{d.address}</div>}
                {d.clientPhone && <div className="small">{d.clientPhone}</div>}
                {d.refunds.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {d.refunds.map((r) => <div key={r.id} className="small">↩︎ {money(r.amount)} · {libelle(REFUND_RESPONSIBILITY_LABELS, r.responsibility)}{r.reason ? ` · ${r.reason}` : ''}</div>)}
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  {d.timeline.filter((x) => x.at).map((x, i) => <div key={`${x.label}-${i}`} className="small" style={{ opacity: 0.75 }}>• {x.label} — {fmtDate(x.at)}</div>)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function RestaurantDetailModal({ selected, detail, orders, pret, onClose, onSuspend, onApprove, onReactivate, onDelete, onChanged, onToggleListing, onToggleTest, onTerminal, onLandingRank, onZoneDelivery }) {
  // Motif de coupure de la livraison Fairide (zone sans livreur), saisi dans la modale.
  const [zoneMotif, setZoneMotif] = useState('');
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState(null);
  const [crmProspect, setCrmProspect] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [onglet, setOnglet] = useState('apercu');

  function loadDocuments() {
    setDocuments(null);
    api(`/admin/documents?targetType=restaurant&targetId=${selected.id}&limit=10`, { token }).then((r) => setDocuments(r.rows)).catch(() => setDocuments([]));
  }

  useEffect(() => {
    setInvoices(null);
    api(`/admin/invoices?restaurantId=${selected.id}&limit=5`, { token }).then((r) => setInvoices(r.rows)).catch(() => setInvoices([]));
    setCrmProspect(null);
    api(`/admin/crm/prospects?restaurantId=${selected.id}&limit=1`, { token }).then((r) => setCrmProspect(r.rows[0] || null)).catch(() => {});
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  // Le formulaire tel qu'ouvert : à l'enregistrement, seuls les champs changés partent (voir saveEdit).
  const formDepart = useRef(null);
  function startEdit() {
    formDepart.current = ({
      name: detail.name, commune: detail.commune, neighborhood: detail.neighborhood || '', responsibleName: detail.responsibleName,
      companyNumber: detail.companyNumber, vatNumber: detail.vatNumber, legalName: detail.legalName,
      phone: detail.restaurantPhone || '', addressStreet: detail.addressStreet || '', addressNumber: detail.addressNumber || '',
      addressPostalCode: detail.addressPostalCode || '', addressCity: detail.addressCity || ''
    });
    setForm(formDepart.current);
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      /* SEULEMENT CE QUI A CHANGÉ (2026-10-25). Le formulaire, pris dans la fiche à l'ouverture, partait en entier : corriger
       * le téléphone effaçait le nom légal, le n° d'entreprise ou de TVA que le commerce venait de remplir (EcranLegal). Les
       * quatre parties de l'adresse partent ensemble (le serveur la reconstruit et la géolocalise). */
      const depart = formDepart.current || {};
      const adresse = ['addressStreet', 'addressNumber', 'addressPostalCode', 'addressCity'];
      const corps = Object.fromEntries(Object.entries(form).filter(([k, v]) => !adresse.includes(k) && v !== depart[k]));
      if (adresse.some((k) => form[k] !== depart[k])) adresse.forEach((k) => { corps[k] = form[k]; });
      if (!Object.keys(corps).length) { setEditing(false); return; }
      await api(`/admin/restaurants/${selected.id}`, { method: 'PATCH', token, body: corps });
      toast(tr('adminRestos.toastUpdated'));
      setEditing(false);
      onChanged();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setSaving(false);
    }
  }

  const biz = detail ? BUSINESS_STATUS_LABELS[detail.businessStatus] : null;
  return createPortal(
    <RecordDrawer
      title={selected.name}
      subtitle={detail ? `${detail.commune}${detail.neighborhood ? ` (${detail.neighborhood})` : ''} · ${detail.cuisine}` : ''}
      badge={biz ? <span className="pill" style={{ color: biz.color }}>{biz.label}</span> : null}
      actions={<a href={cheminFiche(selected)} target="_blank" rel="noreferrer" className="btn-outline btn-sm" style={{ textDecoration: 'none' }}>{tr('adminRestos.viewPage')}</a>}
      tabs={[
        { key: 'apercu', label: tr('adminCommon.tabOverview') },
        { key: 'commandes', label: tr('adminCommon.tabOrders'), count: orders ? orders.total : null },
        { key: 'finance', label: tr('adminCommon.tabFinance'), count: invoices ? invoices.length : null },
        { key: 'documents', label: tr('adminCommon.tabDocuments'), count: documents ? documents.length : null },
        { key: 'suivi', label: tr('adminCommon.tabFollowUp'), count: detail?.notes ? detail.notes.length : null }
      ]}
      tab={onglet} onTab={setOnglet} onClose={onClose} width={680}
    >
      {!detail && <div className="small">{tr('adminCommon.loading')}</div>}
      {detail && onglet === 'apercu' && !editing && (
        <>
          {/* Avant les coordonnées et les chiffres : un commerce qui n'a pas le droit de vendre de la
              nourriture prime sur son panier moyen. */}
          {!estTest(detail) && pret && <PretLancement pret={pret} tr={tr} />}
          <ConformitePanel detail={detail} onChanged={onChanged} />
          <ContactCommerce r={detail} tr={tr} fiche />
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.ownerEmailLine', { name: detail.responsibleName || '-', email: detail.email, phone: '' })}</p>
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.legalLine', { legal: detail.legalName || '-', n: detail.companyNumber || '-', vat: detail.vatNumber || '-' })}</p>
          {/* D'où vient la fiche remplie à l'inscription. Un commerce saisi à la main est un commerce
              comme un autre — c'est juste qu'aucune source extérieure ne confirme son nom et son adresse. */}
          {detail.signupBusinessSource === 'manuel' && (
            <p className="small" style={{ margin: '2px 0', color: 'var(--ink-soft)' }}>{tr('adminRestos.sourceManual')}</p>
          )}
          {detail.signupBusinessSource === 'recherche' && (
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.sourceFound')}</p>
          )}
          {/* Offert ou facturé, et l'état Stripe, en mots (audit du 19/10, admin-26 / admin-86 : « Abonnement : none »). */}
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.subscriptionLineWords', { offer: detail.isDemo ? tr('adminRestos.subDemo') : detail.subscriptionBillingEnabled ? tr('adminRestos.subBilled') : tr('adminRestos.subOffered'), sub: libelle(SUBSCRIPTION_STATUS_LABELS, detail.subscriptionStatus || 'none'), mode: libelle(DELIVERY_MODE_LABELS, detail.deliveryMode) })}</p>
          {/* Délai de grâce (fondateur, 2026-10-21) : facturé, pas encore souscrit, commandes ouvertes jusqu'à la date. */}
          {detail.subscriptionBillingEnabled && !detail.isDemo && !!detail.subscriptionGraceUntil && (
            <p className="small" style={{ margin: '2px 0', color: 'var(--orange)' }}>{tr('adminRestos.subGraceUntil', { date: fmtDate(detail.subscriptionGraceUntil) })}</p>
          )}
          {detail.subscriptionBillingEnabled && !detail.isDemo && !detail.subscriptionGraceUntil && !['active', 'trialing'].includes(detail.subscriptionStatus) && (
            <p className="small" style={{ margin: '2px 0', color: 'var(--red)' }}>{tr('adminRestos.subBilledNoOrders')}</p>
          )}
          {/* Livraison Fairide dans la zone : coupée pour un commerce seul (pas de livreur) ; sans objet s'il livre lui-même. */}
          <div className="small zone-livraison" style={{ margin: '6px 0' }}>
            {detail.deliveryMode === 'own' ? (
              <span style={{ color: 'var(--ink-faint)' }}><Icone nom="scooter" taille={16} className="icone-texte" />{' '}{tr('adminRestos.zoneDeliveryOwn')}</span>
            ) : detail.fairideDeliveryDisabled ? (
              <>
                <span className="pill"><Icone nom="interdit" taille={16} className="icone-texte" />{' '}{tr('adminRestos.zoneDeliveryOffBadge')}</span>
                {detail.fairideDeliveryDisabledReason && <span style={{ marginLeft: 6 }}>{detail.fairideDeliveryDisabledReason}</span>}
                <button type="button" className="btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => onZoneDelivery?.(detail.id, false)}>{tr('adminRestos.zoneDeliveryOn')}</button>
              </>
            ) : (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input style={{ flex: '1 1 220px', fontSize: 12 }} placeholder={tr('adminRestos.zoneDeliveryReasonPh')} value={zoneMotif} onChange={(e) => setZoneMotif(e.target.value)} aria-label={tr('adminRestos.zoneDeliveryReasonPh')} />
                <button type="button" className="btn-outline btn-sm" onClick={() => onZoneDelivery?.(detail.id, true, zoneMotif)}>{tr('adminRestos.zoneDeliveryOff')}</button>
              </div>
            )}
          </div>
          {detail.plan && <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.planLine', { plan: tr('adminRestos.planComplete') })}</p>}
          {detail.terminal && (
            <div className="small" style={{ margin: '2px 0' }}>
              <p style={{ margin: 0 }}>{tr('adminRestos.terminalLine', { status: tr(`adminRestos.terminalStatus_${detail.terminal.status}`), amount: Number(detail.terminal.depositAmount || 80).toFixed(0), rank: detail.terminal.signupRank ? tr('adminRestos.terminalRank', { n: detail.terminal.signupRank }) : '' })}{detail.terminal.note ? ` · ${detail.terminal.note}` : ''}</p>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {['none', 'rendu', 'rembourse', 'conserve'].includes(detail.terminal.status) && detail.terminal.eligibleOffert && <button className="btn-outline" onClick={() => onTerminal('offert', 'terminalOffer')}>{tr('adminRestos.terminalOffer')}</button>}
                {['none', 'rendu', 'rembourse', 'conserve'].includes(detail.terminal.status) && !detail.terminal.eligibleOffert && <button className="btn-outline" onClick={() => onTerminal('caution_due', 'terminalDue')}>{tr('adminRestos.terminalDue')}</button>}
                {detail.terminal.status === 'caution_due' && <button className="btn-outline" onClick={() => onTerminal('caution_versee', 'terminalPaid')}>{tr('adminRestos.terminalPaid')}</button>}
                {['offert', 'caution_versee'].includes(detail.terminal.status) && <button className="btn-outline" onClick={() => onTerminal('rendu', 'terminalReturned')}>{tr('adminRestos.terminalReturned')}</button>}
                {['offert', 'caution_versee'].includes(detail.terminal.status) && <button className="btn-danger-ghost" onClick={() => onTerminal('conserve', 'terminalKept')}>{tr('adminRestos.terminalKept')}</button>}
                {detail.terminal.status === 'rendu' && <button className="btn-teal" onClick={() => onTerminal('rembourse', 'terminalRefunded')}>{tr('adminRestos.terminalRefunded')}</button>}
              </div>
            </div>
          )}
          <p className="small" style={{ margin: '2px 0' }}>{tr('adminCommon.registeredOnDate', { date: fmtDate(detail.createdAt) })}</p>
          <p className="small" style={{ margin: '6px 0 2px' }}>
            {estTest(detail) ? <>{detail.isDemo ? tr('adminRestos.testLine') : tr('adminRestos.testOwnerLine')}</> : <><span className={`pill ${detail.publicListed ? 'listing-on' : 'listing-off'}`}>{detail.publicListed ? tr('adminRestos.listedPill') : tr('adminRestos.unlistedPill')}</span> {detail.publicListed ? tr('adminRestos.listedLine') : tr('adminRestos.unlistedLine')}</>}
          </p>
          {!estTest(detail) && (
            <div className="row" style={{ gap: 8, alignItems: 'center', margin: '4px 0 6px', flexWrap: 'wrap' }}>
              <label htmlFor="landing-rank" className="small"><b><Icone nom="maison" taille={16} className="icone-texte" />{' '}{tr('adminRestos.landingRankLabel')}</b></label>
              <select id="landing-rank" value={detail.landingRank ?? ''} onChange={(e) => onLandingRank(detail.id, e.target.value)} style={{ maxWidth: 220 }}>
                <option value="">{tr('adminRestos.landingRankNone')}</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{tr('adminRestos.landingRankN', { n })}</option>)}
              </select>
              <span className="small">{tr('adminRestos.landingRankHelp')}</span>
            </div>
          )}
          <div className="drawer-section" style={{ margin: '10px 0', padding: '10px 12px', background: 'var(--surface-soft)', borderRadius: 10 }}>
            <p className="small" style={{ margin: 0 }}><b><Icone nom="restaurants" taille={16} className="icone-texte" />{' '}{tr('adminRestos.menuTitle')}</b> · {detail.menuItemCount !== null && detail.menuItemCount !== undefined ? tr('adminRestos.menuLine', { n: detail.menuItemCount }) : ''}</p>
            {detail.concierge && (
              <p className="small" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                <Icone nom="contrat" taille={16} className="icone-texte" />{' '}{tr('adminRestos.conciergeLine', { platform: detail.concierge.platformLabel, date: fmtDate(detail.concierge.createdAt), status: { en_attente: tr('adminMenu.stPending'), en_cours: tr('adminMenu.stInProgress'), terminee: tr('adminMenu.stDone'), refusee: tr('adminMenu.stRefused') }[detail.concierge.status] || detail.concierge.status })}
                {detail.concierge.notes ? `\n${tr('adminRestos.conciergeNotes', { notes: detail.concierge.notes })}` : ''}
              </p>
            )}
            <Link to={`/admin/restaurants/${detail.id}/menu`} className={detail.conciergeStatus ? 'btn-gold' : 'btn-outline'} style={{ display: 'inline-block', marginTop: 8, padding: '6px 14px', fontSize: 13, textDecoration: 'none' }}>{tr('adminRestos.openMenu')}</Link>
            {!detail.isDemo && <PrixMagasin detail={detail} token={token} api={api} toast={toast} tr={tr} onChanged={onChanged} />}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <BoutonGererCommerce id={detail.id} token={token} api={api} toast={toast} tr={tr} className={detail.conciergeStatus ? 'btn-gold' : 'btn-teal'} />
            <button className="btn-outline" onClick={startEdit}>{tr('adminRestos.editInfo')}</button>
            {!detail.isDemo && detail.ownerId && <TestToggleButton userId={detail.ownerId} isTest={detail.testFlag ?? estCompteTest(detail)} token={token} api={api} toast={toast} tr={tr} onChanged={onToggleTest} />}
            {detail.adminStatus === 'pending' && <button className="btn-teal" onClick={onApprove}>{tr('adminCommon.approve')}</button>}
            {!estTest(detail) && (detail.publicListed || detail.adminStatus === 'approved') && <button className={detail.publicListed ? 'btn-outline' : 'btn-gold'} onClick={onToggleListing}>{detail.publicListed ? tr('adminRestos.unpublish') : tr('adminRestos.publish')}</button>}
            {!detail.isDemo && <BoutonFermerSoir detail={detail} token={token} api={api} toast={toast} tr={tr} onChanged={onChanged} />}
            {!detail.isDemo && <BoutonFacturationAbonnement detail={detail} token={token} api={api} toast={toast} tr={tr} onChanged={onChanged} />}
            {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={onSuspend}>{tr('adminCommon.suspend')}</button>}
            {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={onReactivate}>{tr('adminCommon.reactivate')}</button>}
            <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={onDelete}>{tr('adminRestos.deleteRestaurant')}</button>
          </div>
          {/* CODE-3 : la carte se valide par le commerce, d'un geste, depuis un lien que l'équipe lui envoie. */}
          {!detail.isDemo && <LienValidationCarte restaurantId={detail.id} phone={detail.restaurantPhone} ownerPhone={detail.ownerPhone} managers={detail.managerContacts} token={token} toast={toast} />}
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminRestos.keyFigures')}</h4>
          <DrawerRow label={tr('adminCommon.paidOrders')} value={detail.orderCount} strong />
          <DrawerRow label={tr('adminRestos.foodRevenue')} value={money(detail.revenue)} strong />
          <DrawerRow label={tr('adminRestos.commissionGenerated')} value={money(detail.commissionGenerated)} strong />
          <DrawerRow label={tr('adminRestos.netDue')} value={money(detail.netAmountDue)} strong />
          <DrawerRow label={tr('adminRestos.refundsCharged')} value={money(detail.refundsTotal)} strong />
          <DrawerRow label={tr('adminCommon.avgBasket')} value={money(detail.avgBasket)} strong />
          <DrawerRow label={tr('adminCommon.cancellationRate')} value={pct(detail.cancellationRate)} strong />
          <DrawerRow label={tr('adminRestos.acceptanceRate')} value={pct(detail.acceptanceRate)} strong />
          <DrawerRow label={tr('adminRestos.avgPrepTime')} value={detail.avgPrepMinutes !== null ? tr('adminRestos.prepMinutes', { n: detail.avgPrepMinutes }) : tr('adminRestos.prepNotMeasured')} strong />
        </>
      )}
      {detail && onglet === 'apercu' && editing && form && (
        <div>
          <div className="field"><label htmlFor={idsA11y + '-name'}>{tr('adminCommon.name')}</label><input id={idsA11y + '-name'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          {/* Le quartier se corrigeait jusqu'ici en se connectant sous le compte du commerçant :
              l'API l'acceptait déjà (PATCH /admin/restaurants/:id), seul le formulaire ne l'offrait
              pas. Il est posé à côté de la commune, qui le contient. */}
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="resto-commune">{tr('adminCommon.municipality')}</label><input id="resto-commune" value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="resto-quartier">{tr('adminCommon.neighborhood')}</label><input id="resto-quartier" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor={idsA11y + '-restophone'}>{tr('adminRestos.restoPhone')}</label><input id={idsA11y + '-restophone'} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+32 2 000 00 00" /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 3 }}><label htmlFor={idsA11y + '-street'}>{tr('adminRestos.street')}</label><input id={idsA11y + '-street'} value={form.addressStreet} onChange={(e) => setForm({ ...form, addressStreet: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor={idsA11y + '-number'}>{tr('adminRestos.number')}</label><input id={idsA11y + '-number'} value={form.addressNumber} onChange={(e) => setForm({ ...form, addressNumber: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor={idsA11y + '-postalcode'}>{tr('adminRestos.postalCode')}</label><input id={idsA11y + '-postalcode'} value={form.addressPostalCode} onChange={(e) => setForm({ ...form, addressPostalCode: e.target.value })} /></div>
            <div className="field" style={{ flex: 2 }}><label htmlFor={idsA11y + '-city'}>{tr('adminRestos.city')}</label><input id={idsA11y + '-city'} value={form.addressCity} onChange={(e) => setForm({ ...form, addressCity: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor={idsA11y + '-owner'}>{tr('adminCommon.owner')}</label><input id={idsA11y + '-owner'} value={form.responsibleName} onChange={(e) => setForm({ ...form, responsibleName: e.target.value })} /></div>
          <div className="field"><label htmlFor={idsA11y + '-legalname'}>{tr('adminRestos.legalName')}</label><input id={idsA11y + '-legalname'} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor={idsA11y + '-companynumber'}>{tr('adminRestos.companyNumber')}</label><input id={idsA11y + '-companynumber'} value={form.companyNumber} onChange={(e) => setForm({ ...form, companyNumber: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor={idsA11y + '-tva'}>TVA</label><input id={idsA11y + '-tva'} value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : tr('adminCommon.save')}</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
          </div>
        </div>
      )}
      {detail && onglet === 'commandes' && (
        <CommandesDuCommerce restaurantId={selected.id} orders={orders} token={token} tr={tr} toast={toast} />
      )}
      {detail && onglet === 'finance' && (
        <>
          {crmProspect && (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminRestos.commercialOrigin')}</h4>
                <Link to="/admin/crm" state={{ presetSearch: crmProspect.name }} className="small">{tr('adminRestos.viewInCrm')}</Link>
              </div>
              <div className="small">{tr('adminRestos.crmOwnerLine', { owner: crmProspect.ownerEmail || '-', source: crmProspect.source || '-' })}</div>
              <div className="small">{tr('adminRestos.convertedOn', { date: fmtDate(crmProspect.convertedAt) })}</div>
              <div className="divider" />
            </>
          )}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminRestos.invoices')}</h4>
            <Link to="/admin/invoices" state={{ restaurantId: selected.id }} className="small">{tr('adminRestos.seeAll')}</Link>
          </div>
          {!invoices && <div className="small">{tr('adminCommon.loading')}</div>}
          {invoices && invoices.length === 0 && <div className="small">{tr('adminRestos.noInvoices')}</div>}
          {invoices && invoices.map((inv) => (
            <div key={inv.id} className="drawer-row">
              <span className="small" style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</span>
              <span className="small">{money(inv.totalTtc)} · <span style={{ color: INVOICE_STATUS_LABELS[inv.status]?.color }}>{INVOICE_STATUS_LABELS[inv.status]?.label}</span></span>
            </div>
          ))}
        </>
      )}
      {detail && onglet === 'documents' && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminCommon.documents')}</h4>
            <button className="btn-outline btn-sm" onClick={() => setShowUploadDoc(true)}>{tr('adminCommon.add')}</button>
          </div>
          {!documents && <div className="small">{tr('adminCommon.loading')}</div>}
          {documents && documents.length === 0 && <div className="small">{tr('adminCommon.noDocuments')}</div>}
          {documents && documents.map((doc) => (
            <div key={doc.id} className="drawer-row">
              {/* Document privé : adresse signée demandée à l'ouverture (audit du 19/10, admin-45 ; le lien était mort). */}
              <button type="button" className="lien-bouton small" onClick={() => ouvrirDocument({ url: doc.prive ? null : doc.fileUrl, lien: `/admin/documents/${doc.id}/lien`, token, toast, messageErreur: tr('courierOnboarding.docUnavailable') })}><Icone nom="lien" taille={16} className="icone-texte" />{' '}{doc.title}</button>
              <span className="small">
                {doc.expiryState && <span style={{ color: DOCUMENT_EXPIRY_LABELS[doc.expiryState].color, marginRight: 6 }}>{DOCUMENT_EXPIRY_LABELS[doc.expiryState].label}</span>}
                {DOCUMENT_TYPE_LABELS[doc.documentType]}
              </span>
            </div>
          ))}
          {showUploadDoc && (
            <UploadDocumentModal
              presetTargetType="restaurant" presetTargetId={selected.id} presetTargetLabel={detail.name}
              onClose={() => setShowUploadDoc(false)} onUploaded={() => { setShowUploadDoc(false); loadDocuments(); }}
            />
          )}
        </>
      )}
      {detail && onglet === 'suivi' && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <CreateTicketButton linkType="linkedRestaurantId" linkId={selected.id} label={detail.name} />
            <CreateTaskButton targetType="restaurant" targetId={selected.id} label={detail.name} />
          </div>
          <AdminNotesPanel targetType="restaurant" targetId={selected.id} notes={detail.notes} onAdded={onChanged} />
          <div className="divider" />
          <AdminActionHistory actions={detail.actions} />
        </>
      )}
    </RecordDrawer>,
    document.body
  );
}
