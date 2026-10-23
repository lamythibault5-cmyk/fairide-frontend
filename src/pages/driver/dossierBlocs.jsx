import { useEffect, useId, useRef, useState } from 'react';
import { api, apiUpload } from '../../api';
import { useToast } from '../../context/ToastContext';
import { getLocale } from '../../context/LanguageContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icone from '../../components/Icone';
import { euros } from '../../prixPlat';
import { AVEC_ECHEANCE, ECHEANCE_REQUISE, STATUTS } from './dossierCommun';

// LES BLOCS DU DOSSIER LIVREUR UNE FOIS ENVOYÉ (sortis d'Onboarding.jsx le 2026-10-19, deuxième audit design) : le dossier du
// site (Onboarding.jsx) et celui de l'application, envoyé ou validé (DossierSuivi.jsx), montrent les mêmes blocs avec les mêmes
// routes. `enFeuille` : rendu sans carte ni bouton « Ouvrir », pour une feuille de l'app (SousEcran) ou une remarque à filet.

const euro = (n) => euros(Number(n || 0));

// AVANT DE COMMENCER (fondateur, 2026-10-06) : ce que le livreur doit savoir — il commence après validation par Fairide ;
// jusqu'à trois courses à la fois s'il ne livre que pour Fairide (2026-10-17), une seule s'il livre aussi ailleurs ; comment il
// est payé ; le fonds d'assurance Fairide (10 % des frais de livraison) ; sa responsabilité en cas d'accident ou d'infraction.
export function AvantDeCommencer({ c, t, pricing, replie = false }) {
  const autre = c?.otherPlatforms?.works === true;
  const eur = (v) => `${Number(v || 0).toFixed(2).replace('.', ',')} €`;
  const p = { base: eur(pricing?.deliveryBaseFee ?? 5), km: Number(pricing?.deliveryBaseKm ?? 1), perKm: eur(pricing?.driverPerKmMotor ?? 0.8), radius: String(pricing?.secondOrderRadiusKm ?? 2).replace('.', ','), delay: Number(pricing?.extraOrderMaxDelayMin ?? 10) };
  return (
    <div className={replie ? undefined : 'card'} style={{ marginBottom: replie ? 0 : 12, marginTop: replie ? 8 : 0 }}>
      {!replie && <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.beforeTitle')}</h3>}
      <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li>{t('courierOnboarding.beforeValidation')}</li>
        <li>{autre ? t('courierOnboarding.beforeOneOrder') : t('courierOnboarding.beforeThreeOrders', { radius: p.radius, delay: p.delay })}</li>
        <li>{t('courierOnboarding.beforePayment', p)}</li>
        <li>{t('courierOnboarding.beforeInsurance')}</li>
        <li>{t('courierOnboarding.beforeLiability')}</li>
      </ul>
    </div>
  );
}

// Notifications non lues du livreur (alertes de plafond, blocage, changement de statut), avec « lu ».
export function Notifications({ t, token, enFeuille = false }) {
  const [liste, setListe] = useState([]);
  const charger = () => api('/couriers/me/notifications', { token }).then((r) => setListe((Array.isArray(r) ? r : r?.notifications ?? []).filter((n) => !n.readAt))).catch(() => {});
  useEffect(() => { charger(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  async function lire(ids) {
    try { await api('/couriers/me/notifications/read', { method: 'PATCH', token, body: ids ? { ids } : {} }); } catch { /* silencieux : la liste est rechargée */ }
    charger();
  }
  if (!liste.length) return null;
  const texte = (n) => {
    const p = n.payload ?? {};
    const v = { level: p.level ?? '', year: p.year ?? '', used: euro(p.used), max: euro(p.max), remaining: euro(p.remaining) };
    if (n.kind === 'threshold_alert') return t('courierOnboarding.notif_threshold_alert', v);
    if (n.kind === 'threshold_blocked') return t('courierOnboarding.notif_threshold_blocked', v);
    if (n.kind === 'status_changed') return t('courierOnboarding.notif_status_changed');
    return p.message || n.kind || t('courierOnboarding.notif_other');
  };
  // Dans la feuille de l'app : une remarque à filet (ecran-livreur.css, .ecl-note), pas la carte au gros trait.
  if (enFeuille) {
    return (
      <div className="ecl-note ecl-note-liste">
        <Icone nom="cloche" taille={18} />
        <div className="ecl-grow">
          {liste.map((n) => (
            <p key={n.id}>{n.createdAt ? `${new Date(n.createdAt).toLocaleDateString(getLocale())} · ` : ''}{texte(n)}</p>
          ))}
          <button type="button" className="lien-bouton" onClick={() => lire(null)}>{t(liste.length > 1 ? 'courierOnboarding.markAllRead' : 'courierOnboarding.markRead')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card courier-state warn">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b><Icone nom="cloche" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.notificationsTitle')} ({liste.length})</b>
        <button type="button" className="btn-ghost btn-sm" onClick={() => lire(null)}>{t('courierOnboarding.markAllRead')}</button>
      </div>
      {liste.map((n) => (
        <div key={n.id} className="row small" style={{ justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span>{n.createdAt ? `${new Date(n.createdAt).toLocaleDateString(getLocale())} · ` : ''}{texte(n)}</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => lire([n.id])}>{t('courierOnboarding.markRead')}</button>
        </div>
      ))}
    </div>
  );
}

// Changement de statut en libre-service : le dossier repasse en vérification (documents du nouveau
// statut, nouveau contrat), d'où la confirmation.
export function ChangementStatut({ d, t, token, action, busy, onChanged, enFeuille = false }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const c = d.courier;
  const choix = STATUTS.filter((x) => x !== c.statusType);
  const [cible, setCible] = useState(choix.includes('independent') ? 'independent' : choix[0] || '');
  const [ouvert, setOuvert] = useState(c.lifecycleStatus === 'blocked_threshold');
  const [confirm, setConfirm] = useState(false);
  async function changer() {
    setConfirm(false);
    const ok = await action(() => api('/couriers/me/status', { method: 'POST', token, body: { statusType: cible } }), t('courierOnboarding.toastStatusChanged'));
    if (ok) onChanged?.();
  }
  const confirmation = <ConfirmDialog open={confirm} title={t('courierOnboarding.changeStatusConfirmTitle')} message={t('courierOnboarding.changeStatusConfirmBody', { status: cible ? t(`courierOnboarding.status_${cible}`) : '' })} confirmLabel={t('courierOnboarding.changeStatusBtn')} loading={busy} onConfirm={changer} onCancel={() => setConfirm(false)} />;
  // Dans une feuille de l'app (DossierSuivi.jsx) : le texte, le choix et le bouton, sans la carte ni « Ouvrir ».
  if (enFeuille) {
    return (
      <div className="ecl-statut-feuille">
        <p className="ecl-texte">{c.lifecycleStatus === 'blocked_threshold' ? t('courierOnboarding.changeStatusBlocked') : t('courierOnboarding.changeStatusHelp')}</p>
        <div className="field">
          <label htmlFor={idsA11y + '-newstatus'}>{t('courierOnboarding.newStatus')}</label>
          <select id={idsA11y + '-newstatus'} value={cible} onChange={(e) => setCible(e.target.value)}>{choix.map((x) => <option key={x} value={x}>{t(`courierOnboarding.status_${x}`)}</option>)}</select>
        </div>
        <button type="button" className="btn-teal ecl-bouton-dossier" disabled={busy || !cible} onClick={() => setConfirm(true)}>{t('courierOnboarding.changeStatusBtn')}</button>
        {confirmation}
      </div>
    );
  }
  return (
    <div className="card" id="changement-statut">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}><Icone nom="melanger" taille={16} className="icone-texte" />{' '}{t('courierOnboarding.changeStatusTitle')}</h3>
        <button type="button" className="btn-ghost" onClick={() => setOuvert((v) => !v)}>{ouvert ? t('courierOnboarding.hide') : t('courierOnboarding.open')}</button>
      </div>
      {ouvert && (
        <div style={{ marginTop: 10 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>{c.lifecycleStatus === 'blocked_threshold' ? t('courierOnboarding.changeStatusBlocked') : t('courierOnboarding.changeStatusHelp')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor={idsA11y + '-newstatus'}>{t('courierOnboarding.newStatus')}</label>
              <select id={idsA11y + '-newstatus'} value={cible} onChange={(e) => setCible(e.target.value)}>{choix.map((x) => <option key={x} value={x}>{t(`courierOnboarding.status_${x}`)}</option>)}</select>
            </div>
            <button type="button" className="btn-outline" disabled={busy || !cible} onClick={() => setConfirm(true)}>{t('courierOnboarding.changeStatusBtn')}</button>
          </div>
        </div>
      )}
      {confirmation}
    </div>
  );
}

// Pièces refusées sans remplacement déposé depuis, hors brouillon (voir l'appel plus haut).
/* LE NUMÉRO D'ENTREPRISE, APRÈS L'ENVOI (fondateur, 18/10/2026). Le dossier est parti sans lui (MANQUES_APRES_ENVOI) ; les
 * étapes sont masquées une fois le dossier envoyé, donc on le demande ici, seul. Dès qu'il est là, l'équipe peut valider.
 * LE N° DE TVA AUSSI (audit du 19/10, courier-11) : un assujetti sans n° de TVA ne pouvait plus l'ajouter nulle part, et la
 * carte disparaissait dès le BCE saisi. Le serveur déduit désormais le n° de TVA du BCE (BE + numéro) ; s'il manque encore
 * (BCE déjà connu), la carte le demande, lui. `manques` : d.missing. */
export function NumeroEntrepriseEnAttente({ t, token, busy, action, manques = [] }) {
  const tva = !manques.includes('bce') && manques.includes('tva_numero');
  const [bce, setBce] = useState('');
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t(tva ? 'courierOnboarding.vatPendingTitle' : 'courierOnboarding.bcePendingTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t(tva ? 'courierOnboarding.vatPendingText' : 'courierOnboarding.bcePendingText')}</p>
      <form className="row" style={{ gap: 8, flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); action(() => api('/couriers/me', { method: 'PATCH', token, body: tva ? { vatNumber: bce.trim() } : { companyNumber: bce.trim() } }), t(tva ? 'courierOnboarding.vatSaved' : 'courierOnboarding.bceSaved')); }}>
        <input aria-label={t(tva ? 'courierOnboarding.fVatNumber' : 'courierOnboarding.fBce')} value={bce} onChange={(e) => setBce(e.target.value)} placeholder={tva ? 'BE0123456789' : '0123.456.789'} inputMode={tva ? 'text' : 'numeric'} style={{ flex: '1 1 180px' }} />
        <button type="submit" className="btn-gold" disabled={busy || !bce.trim()}>{busy ? '…' : t('common.save')}</button>
      </form>
    </div>
  );
}

/* APRÈS LA VALIDATION, LE DOSSIER RESTE À LA MAIN DU LIVREUR (audit du 19/10, courier-5, courier-6, courier-7, courier-30). Les
 * étapes ne s'affichent que pour un brouillon : un livreur validé ne pouvait plus changer ni sa zone, ni son véhicule, ni ses
 * autres plateformes (qui décident d'une ou trois courses à la fois), ni son sac, ni déposer un titre de séjour renouvelé.
 * Trois blocs, mêmes routes que le dossier (PATCH /couriers/me, POST /couriers/me/documents), sur le site (Onboarding.jsx) et
 * dans l'app (DossierSuivi.jsx, en feuilles). Rien ici ne fait repasser le dossier en vérification : le statut se change par
 * « Changer de statut », et un titre de séjour déposé arrive à l'équipe, qui le vérifie (serveur). */
export function MesCourses({ d, t, token, busy, action }) {
  const id = useId();
  const c = d.courier;
  const [f, setF] = useState(() => ({
    zone: c.zone || '', vehicleType: c.vehicleType || '', licenceNumber: c.licenceNumber || '', licencePlate: c.licencePlate || '',
    worksOtherPlatforms: c.otherPlatforms?.works === true ? 'yes' : c.otherPlatforms?.works === false ? 'no' : '', bagOption: c.bag?.option || ''
  }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const motorise = ['scooter', 'voiture'].includes(f.vehicleType);
  // Un sac Fairide déjà remis ne se change plus ici (le serveur le refuse) : le choix reste affiché, grisé.
  const sacFige = !['none', 'due'].includes(c.bag?.depositStatus || 'none');
  // Seul ce qui a changé part : un champ renvoyé tel quel n'a rien à dire au serveur (ni à l'équipe).
  const corps = () => {
    const b = {};
    if (f.zone && f.zone !== (c.zone || '')) b.zone = f.zone;
    if (f.vehicleType && f.vehicleType !== (c.vehicleType || '')) b.vehicleType = f.vehicleType;
    if (motorise && f.licenceNumber.trim() !== (c.licenceNumber || '')) b.licenceNumber = f.licenceNumber.trim();
    if (motorise && f.licencePlate.trim() !== (c.licencePlate || '')) b.licencePlate = f.licencePlate.trim();
    if (['yes', 'no'].includes(f.worksOtherPlatforms) && (f.worksOtherPlatforms === 'yes') !== c.otherPlatforms?.works) b.worksOtherPlatforms = f.worksOtherPlatforms === 'yes';
    if (!sacFige && f.bagOption && f.bagOption !== (c.bag?.option || '')) b.bagOption = f.bagOption;
    return b;
  };
  const rien = Object.keys(corps()).length === 0;
  const champ = (cle, label, enfant, aide = null) => (
    <div className="field">
      <label htmlFor={`${id}-${cle}`}>{label}</label>
      {enfant}
      {aide && <p className="small" style={{ margin: '4px 0 0', opacity: 0.8 }}>{aide}</p>}
    </div>
  );
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.ridesTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('courierOnboarding.ridesHelp')}</p>
      <div className="courier-grid">
        {champ('zone', t('courierOnboarding.fZone'), <select id={`${id}-zone`} value={f.zone} onChange={set('zone')}><option value="">-</option>{(d.zones ?? []).map((z) => <option key={z} value={z}>{z}</option>)}</select>)}
        {champ('vehicule', t('courierOnboarding.fVehicle'), <select id={`${id}-vehicule`} value={f.vehicleType} onChange={set('vehicleType')}><option value="">-</option>{(d.vehicles ?? []).map((v) => <option key={v} value={v}>{t(`courierOnboarding.vehicle_${v}`)}</option>)}</select>, motorise ? t('courierOnboarding.motorNeedsLicence') : null)}
        {motorise && champ('permis', t('courierOnboarding.fLicence'), <input id={`${id}-permis`} value={f.licenceNumber} onChange={set('licenceNumber')} />)}
        {motorise && champ('plaque', t('courierOnboarding.fPlate'), <input id={`${id}-plaque`} value={f.licencePlate} onChange={set('licencePlate')} placeholder="1-ABC-123" />, f.vehicleType === 'voiture' ? t('courierOnboarding.carWeightHelp') : null)}
        {champ('plateformes', t('auth.platformsTitle'), <select id={`${id}-plateformes`} value={f.worksOtherPlatforms} onChange={set('worksOtherPlatforms')}><option value="">-</option><option value="no">{t('auth.platformsNo')}</option><option value="yes">{t('auth.platformsYes')}</option></select>, t('auth.platformsHelp'))}
        {champ('sac', t('courierOnboarding.fBag'), <select id={`${id}-sac`} value={f.bagOption} onChange={set('bagOption')} disabled={sacFige}><option value="">-</option><option value="own">{t('auth.bag_own')}</option><option value="fairide">{t('auth.bag_fairide')}</option></select>,
          sacFige ? t(`courierOnboarding.bagDeposit_${c.bag.depositStatus}`, { amount: c.bag?.depositAmount || 40 }) : t('courierOnboarding.fBagHelp', { amount: c.bag?.depositAmount || 40 }))}
      </div>
      <button type="button" className="btn-teal" disabled={busy || rien || (motorise && (!f.licenceNumber.trim() || !f.licencePlate.trim()))}
        onClick={() => action(() => api('/couriers/me', { method: 'PATCH', token, body: corps() }), t('courierOnboarding.ridesSaved'))}>
        {busy ? '…' : t('courierOnboarding.save')}
      </button>
    </div>
  );
}

// Titre de séjour et carte professionnelle d'un livreur hors EEE (CPS art. 175/1) : la pièce la plus lointaine de chaque type,
// son échéance et son état, puis « date, puis fichier » pour déposer la nouvelle (la date est exigée avant le fichier).
export function PiecesSejour({ d, t, token, busy, action }) {
  const toast = useToast();
  const [echeances, setEcheances] = useState({});
  const fichiers = useRef({});
  const c = d.courier;
  if (c.nationalityGroup !== 'THIRD') return null;
  const types = ['residence_permit', ...(c.selfEmploymentByResidence ? [] : ['professional_card'])];
  const docs = d.documents ?? [];
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const jour = (x) => new Date(`${String(x).slice(0, 10)}T12:00:00`).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  async function deposer(type, e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    const ok = await action(() => apiUpload('/couriers/me/documents', { file, token, fieldName: 'file', fields: { docType: type, expiresAt: echeances[type] } }), t('courierOnboarding.toastDocUploaded'));
    if (ok) setEcheances((x) => ({ ...x, [type]: '' }));
  }
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.permitsTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('courierOnboarding.permitsHelp')}</p>
      {types.map((type) => {
        const derniere = docs.filter((x) => x.docType === type && !x.rejectedReason && x.expiresAt)
          .sort((a, b) => String(b.expiresAt).localeCompare(String(a.expiresAt)))[0];
        const expiree = derniere && String(derniere.expiresAt).slice(0, 10) < aujourdHui;
        const etat = !derniere ? t('courierOnboarding.permitNone')
          : `${t(expiree ? 'courierOnboarding.permitExpired' : 'courierOnboarding.permitValidUntil', { date: jour(derniere.expiresAt) })} · ${t(derniere.verifiedAt ? 'courierOnboarding.permitChecked' : 'courierOnboarding.permitBeingChecked')}`;
        return (
          <div key={type} className="courier-doc">
            <div>
              <b>{t(`courierOnboarding.doc_${type}`)}</b>
              <p className={`small${!derniere || expiree ? ' texte-erreur' : ''}`} style={{ margin: '2px 0 0' }}>{etat}</p>
            </div>
            <div className="courier-doc-actions">
              <label className="courier-doc-echeance small">
                {t('courierOnboarding.docExpiryRequiredLabel')}
                <input type="date" min={aujourdHui} value={echeances[type] || ''} onChange={(e) => setEcheances((x) => ({ ...x, [type]: e.target.value }))} />
              </label>
              <input ref={(el) => { fichiers.current[type] = el; }} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => deposer(type, e)} />
              <button type="button" className="btn-outline" disabled={busy} onClick={() => {
                if (!echeances[type]) { toast(t('courierOnboarding.docExpiryFirst'), 'erreur'); return; }
                fichiers.current[type]?.click();
              }}>{t('courierOnboarding.permitUpload')}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Renouvellement de l'étudiant-indépendant : confirmer son école et son année académique lève le drapeau (serveur).
export function ConfirmerEcole({ d, t, token, busy, action }) {
  const id = useId();
  const c = d.courier;
  const [ecole, setEcole] = useState(c.student?.school || '');
  const [annee, setAnnee] = useState('');
  if (!c.needsRenewal || c.statusType !== 'student_independent') return null;
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('courierOnboarding.renewalConfirmTitle')}</h3>
      <div className="courier-grid">
        <div className="field"><label htmlFor={`${id}-ecole`}>{t('courierOnboarding.fSchool')}</label><input id={`${id}-ecole`} value={ecole} onChange={(e) => setEcole(e.target.value)} /></div>
        <div className="field"><label htmlFor={`${id}-annee`}>{t('courierOnboarding.fAcademicYear')}</label><input id={`${id}-annee`} value={annee} onChange={(e) => setAnnee(e.target.value)} placeholder="2026-2027" /></div>
      </div>
      <button type="button" className="btn-teal" disabled={busy || ecole.trim().length < 2 || !annee.trim()}
        onClick={() => action(() => api('/couriers/me', { method: 'PATCH', token, body: { schoolName: ecole.trim(), academicYear: annee.trim() } }), t('courierOnboarding.renewalConfirmed'))}>
        {busy ? '…' : t('courierOnboarding.renewalConfirmBtn')}
      </button>
    </div>
  );
}

export function PiecesARemplacer({ d, t, token, busy, action }) {
  const toast = useToast();
  const [echeances, setEcheances] = useState({});
  const fichiers = useRef({});
  const docs = d.documents ?? [];
  const types = [...new Set(docs.filter((x) => x.rejectedReason).map((x) => x.docType))]
    .filter((type) => !docs.some((x) => x.docType === type && !x.rejectedReason));
  if (!types.length) return null;
  async function deposer(type, e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    await action(() => apiUpload('/couriers/me/documents', { file, token, fieldName: 'file', fields: { docType: type, expiresAt: AVEC_ECHEANCE.includes(type) ? echeances[type] || undefined : undefined } }), t('courierOnboarding.toastDocUploaded'));
  }
  return (
    <div className="card" role="alert" style={{ borderColor: 'var(--red)' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t('courierOnboarding.docsToReplaceTitle')}</h3>
      {types.map((type) => {
        const refus = docs.filter((x) => x.docType === type && x.rejectedReason).at(-1);
        return (
          <div key={type} className="courier-doc">
            <div>
              <b>{t(`courierOnboarding.doc_${type}`)}</b>
              <p className="small texte-erreur" style={{ margin: '2px 0 0' }}>{refus?.rejectedReason}</p>
            </div>
            <div className="courier-doc-actions">
              {AVEC_ECHEANCE.includes(type) && (
                <label className="courier-doc-echeance small">
                  {t(ECHEANCE_REQUISE.includes(type) ? 'courierOnboarding.docExpiryRequiredLabel' : 'courierOnboarding.docExpiryLabel')}
                  <input type="date" value={echeances[type] || ''} onChange={(e) => setEcheances((x) => ({ ...x, [type]: e.target.value }))} />
                </label>
              )}
              <input ref={(el) => { fichiers.current[type] = el; }} type="file" accept={['profile_photo', 'selfie'].includes(type) ? 'image/*' : 'application/pdf,image/*'} capture={type === 'selfie' ? 'user' : undefined} style={{ display: 'none' }} onChange={(e) => deposer(type, e)} />
              <button type="button" className="btn-gold" disabled={busy} onClick={() => {
                if (ECHEANCE_REQUISE.includes(type) && !echeances[type]) { toast(t('courierOnboarding.docExpiryFirst'), 'erreur'); return; }
                fichiers.current[type]?.click();
              }}>{t('courierOnboarding.docReplace')}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
