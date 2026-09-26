import { useEffect, useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { COMMUNES, RESTAURANT_TYPES } from '../../menuCategories';
import { formatFullSchedule } from '../../openingHours';
import { cuisineDepuisOsm } from '../../osmCuisine';
import AddressSearch from '../AddressSearch';
import AddressRecognition from '../AddressRecognition';
import BusinessSearch from '../BusinessSearch';
import OpeningHoursEditor from '../OpeningHoursEditor';

// Création du commerce, en étapes — le dernier recours quand la création automatique depuis
// l'inscription a échoué (voir creerDepuisIndice dans DashboardLayout.jsx).
//
// POURQUOI DES ÉTAPES (2026-09-23). C'était un formulaire d'un seul tenant : recherche, identité,
// adresse, horaires, présentation, services, précédé de deux paragraphes d'introduction. On le découpe
// comme l'inscription (Auth.jsx, mêmes classes auth-step-*) : une question à la fois, la barre de
// progression, Retour / Continuer. Chaque étape ne valide que ce qu'elle montre, au moment où on la
// quitte — plus d'erreur « adresse requise » en bas d'une page dont l'adresse est tout en haut.
//
// Retiré au passage : le champ « URL de la photo d'accueil » (personne ne colle une URL d'image ; la
// photo se choisit dans la galerie depuis Mon commerce › Nom et photos, une fois le commerce créé).
const ETAPES = ['identite', 'adresse', 'horaires', 'services', 'contact'];

const horairesRemplis = (h) => !!h && Object.values(h).some((c) => Array.isArray(c) && c.length);

export default function CreationCommerce({ fondateur, onCree, ouvrirDemandeCarte }) {
  const ids = useId();
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const [etape, setEtape] = useState(0);
  const [envoi, setEnvoi] = useState(false);

  // Commerce déjà désigné à l'inscription : les étapes arrivent préremplies, on ne redemande pas de le chercher.
  const [commerceDejaChoisi, setCommerceDejaChoisi] = useState(false);
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState(RESTAURANT_TYPES[0].value);
  const [customCuisine, setCustomCuisine] = useState('');
  const [commune, setCommune] = useState(COMMUNES[0]);
  const [neighborhood, setNeighborhood] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [recoEtat, setRecoEtat] = useState('idle');
  const [adresseConfirmee, setAdresseConfirmee] = useState(false);
  const [hours, setHours] = useState(null);
  const [horairesDepuisInscription, setHorairesDepuisInscription] = useState(false);
  const [modifierHoraires, setModifierHoraires] = useState(false);
  const [openingHoursTexte, setOpeningHoursTexte] = useState('');
  const [offersDelivery, setOffersDelivery] = useState(true);
  const [offersPickup, setOffersPickup] = useState(true);
  const [deliveryModePref, setDeliveryModePref] = useState('fairide');
  const [desc, setDesc] = useState('');
  const [siteWeb, setSiteWeb] = useState('');
  const [telephoneCommerce, setTelephoneCommerce] = useState('');

  // Ce que la reconnaissance d'adresse a trouvé à l'inscription (voir Auth.jsx) : commune, quartier,
  // adresse, et le commerce référencé sur Internet si le restaurateur l'a désigné.
  useEffect(() => {
    try {
      const brut = localStorage.getItem('fairide_resto_hint'); if (!brut) return;
      const h = JSON.parse(brut);
      if (h.name) { setName((v) => v || h.name); setCommerceDejaChoisi(true); }
      // Le type choisi à l'inscription prime ; sinon celui deviné depuis la fiche OpenStreetMap.
      if (h.cuisineType && RESTAURANT_TYPES.some((rt) => rt.value === h.cuisineType)) {
        setCuisine(h.cuisineType);
        if (h.cuisineType === 'Autre' && h.customCuisine) setCustomCuisine(h.customCuisine);
      } else {
        const typeDevine = cuisineDepuisOsm(h.cuisine, h.type);
        if (typeDevine && RESTAURANT_TYPES.some((rt) => rt.value === typeDevine)) setCuisine(typeDevine);
      }
      if (h.openingHours) setOpeningHoursTexte(h.openingHours);
      if (h.hours && typeof h.hours === 'object') { setHours(h.hours); setHorairesDepuisInscription(true); }
      if (h.website) setSiteWeb(h.website);
      if (h.phone) setTelephoneCommerce(h.phone);
      // Quartier depuis la position du commerce et description publiée sur son site : préremplis, modifiables.
      if ((h.lat && h.lng) || h.website) {
        const q = new URLSearchParams(); if (h.lat && h.lng) { q.set('lat', h.lat); q.set('lng', h.lng); } if (h.website) q.set('website', h.website); if (h.name) q.set('name', h.name);
        api(`/restaurants/lookup/enrich?${q.toString()}`).then((e) => {
          if (e.neighborhood) setNeighborhood((v) => v || e.neighborhood);
          if (e.description) setDesc((v) => v || e.description);
          // Type de commerce deviné depuis le site, seulement si rien n'a été retenu à l'inscription.
          if (e.cuisine && RESTAURANT_TYPES.some((rt) => rt.value === e.cuisine)) setCuisine((v) => (!v || v === RESTAURANT_TYPES[0].value ? e.cuisine : v));
          // Horaires publiés sur le site du commerce : proposés tant que rien n'a été réglé à la main.
          if (horairesRemplis(e.hours)) {
            setHours((v) => (horairesRemplis(v) ? v : e.hours));
            setHorairesDepuisInscription(true);
          }
          if (e.city && COMMUNES.includes(e.city) && !COMMUNES.includes(h.commune)) setCommune(e.city);
        }).catch(() => { /* enrichissement facultatif */ });
      }
      if (h.services) {
        setOffersDelivery(!!h.services.delivery); setOffersPickup(!!h.services.pickup);
        if (h.services.deliveryMode === 'own' || h.services.deliveryMode === 'fairide') setDeliveryModePref(h.services.deliveryMode);
      }
      if (h.commune && COMMUNES.includes(h.commune)) setCommune(h.commune);
      if (h.neighborhood) setNeighborhood((v) => v || h.neighborhood);
      if (h.street) setAddressStreet((v) => v || h.street);
      if (h.number) setAddressNumber((v) => v || h.number);
      if (h.postalCode) setAddressPostalCode((v) => v || h.postalCode);
    } catch { /* indice illisible : étapes vides */ }
  }, []);
  // Sans indice local (autre appareil, stockage vidé) : le type de cuisine mémorisé sur le compte à l'inscription.
  useEffect(() => {
    try { if (localStorage.getItem('fairide_resto_hint')) return; } catch { /* sans stockage */ }
    const sc = user?.signupCuisine; if (!sc) return;
    if (RESTAURANT_TYPES.some((rt) => rt.value === sc)) setCuisine(sc);
    else { setCuisine('Autre'); setCustomCuisine(sc); }
  }, [user?.signupCuisine]);

  const cle = ETAPES[etape];
  const derniere = etape === ETAPES.length - 1;

  // Ce qui manque à l'étape affichée, ou null. Un compte fondateur passe outre : le serveur complète.
  function manque() {
    if (cle === 'identite' && !name.trim() && !fondateur) return t('dashResto.toastNameRequired');
    if (cle === 'adresse') {
      if (!fondateur && (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim())) return t('dashResto.toastAddressRequired');
      // Adresse tapée mais non reconnue : on ne bloque pas, on demande une confirmation explicite.
      if ((recoEtat === 'none' || recoEtat === 'error') && !adresseConfirmee) return t('dashResto.toastAddressConfirm');
    }
    if (cle === 'horaires' && !fondateur && !horairesRemplis(hours)) return t('dashResto.toastHoursRequired');
    if (cle === 'services' && !offersDelivery && !offersPickup) return t('dashResto.toastServicesRequired');
    return null;
  }

  async function suivant(ev) {
    ev.preventDefault();
    const erreur = manque();
    if (erreur) { toast(erreur); return; }
    if (!derniere) { setEtape(etape + 1); window.scrollTo({ top: 0 }); return; }
    setEnvoi(true);
    try {
      const r = await api('/restaurants', {
        method: 'POST', token,
        body: {
          name: name.trim(), commune, neighborhood: neighborhood.trim(), cuisine: cuisine === 'Autre' ? customCuisine.trim() || 'Autre' : cuisine, desc: desc.trim(),
          addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: commune,
          hours, deliveryMode: deliveryModePref,
          openingHours: openingHoursTexte, offersDelivery, offersPickup, phone: telephoneCommerce.trim(), website: siteWeb.trim()
        }
      });
      // Le site web relevé à l'inscription sert ensuite à lire la carte (Mes produits → import depuis le web).
      try {
        const h = JSON.parse(localStorage.getItem('fairide_resto_hint') || '{}');
        if (h.website) localStorage.setItem('fairide_menu_source_url', h.website);
        ouvrirDemandeCarte(r?.id, h);
        localStorage.removeItem('fairide_resto_hint');
      } catch { /* rien */ }
      onCree(r);
    } catch (e) {
      toast(e.message, 'erreur');
      setEnvoi(false);
    }
  }

  const titres = {
    identite: t('dashResto.identity'), adresse: t('dashResto.addressForDrivers'), horaires: t('dashResto.openingHours'),
    services: t('dashResto.servicesTitle'), contact: t('dashResto.presentationOptional')
  };

  return (
    <form className="card" onSubmit={suivant} style={{ marginTop: 10 }}>
      <div className="auth-step-head">
        <h3>{titres[cle]}</h3>
        <div className="auth-step-bar"><span style={{ width: `${((etape + 1) / ETAPES.length) * 100}%` }} /></div>
      </div>

      {cle === 'identite' && (
        <>
          {!commerceDejaChoisi && <BusinessSearch compact initialPostalCode={addressPostalCode} onPostalCode={(cp) => setAddressPostalCode((v) => v || cp)} onSelect={(f) => {
            if (!f) return;
            if (f.name) setName(f.name);
            const typeDevine = cuisineDepuisOsm(f.cuisine, f.type); if (typeDevine && RESTAURANT_TYPES.some((rt) => rt.value === typeDevine)) setCuisine(typeDevine);
            if (f.street) setAddressStreet(f.street); if (f.number) setAddressNumber(f.number); if (f.postalCode) setAddressPostalCode(f.postalCode);
            if (f.city && COMMUNES.includes(f.city)) setCommune(f.city);
            if (f.openingHours) setOpeningHoursTexte(f.openingHours);
          }} />}
          <div className="field"><label htmlFor={ids + '-nom'}>{t('dashResto.businessName')}</label><input id={ids + '-nom'} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('dashResto.phName')} /></div>
          <div className="field">
            <label htmlFor={ids + '-type'}>{t('dashResto.businessType')}</label>
            <select id={ids + '-type'} value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
              {RESTAURANT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
            </select>
          </div>
          {cuisine === 'Autre' && (
            <div className="field"><label htmlFor={ids + '-autre'}>{t('dashResto.specifyType')}</label><input id={ids + '-autre'} value={customCuisine} onChange={(e) => setCustomCuisine(e.target.value)} placeholder={t('dashResto.phType')} /></div>
          )}
        </>
      )}

      {cle === 'adresse' && (
        <>
          <AddressSearch compact onSelect={(a) => { setAddressStreet(a.street); if (a.number) setAddressNumber(a.number); if (a.postalCode) setAddressPostalCode(a.postalCode); if (a.city && COMMUNES.includes(a.city)) setCommune(a.city); }} />
          <div className="field"><label htmlFor={ids + '-rue'}>{t('dashResto.street')}</label><input id={ids + '-rue'} value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder={t('dashResto.phStreet')} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor={ids + '-num'}>{t('dashResto.number')}</label>
              <input id={ids + '-num'} value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor={ids + '-cp'}>{t('dashResto.postalCode')}</label>
              <input id={ids + '-cp'} inputMode="numeric" value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
            </div>
          </div>
          <div className="field">
            <label htmlFor={ids + '-commune'}>{t('dashResto.municipality')}</label>
            <select id={ids + '-commune'} value={commune} onChange={(e) => setCommune(e.target.value)}>
              {COMMUNES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <AddressRecognition
            street={addressStreet} number={addressNumber} postalCode={addressPostalCode} city={commune} compact discret
            onResult={(r) => { if (r.commune && COMMUNES.includes(r.commune)) setCommune(r.commune); if (r.neighborhood) setNeighborhood((v) => v || r.neighborhood); }}
            onStatus={setRecoEtat} onConfirm={setAdresseConfirmee}
          />
          {fondateur && <p className="small" style={{ margin: '0 0 10px' }}>🛠️ {t('dashResto.founderHint')}</p>}
        </>
      )}

      {cle === 'horaires' && (
        horairesDepuisInscription && !modifierHoraires && hours ? (
          <div className="paiement-encart" style={{ marginBottom: 10 }}>
            <p className="small" style={{ margin: '0 0 4px' }}>✅ {t('dashResto.hoursFromSignup')}</p>
            <div className="closed-banner-schedule" style={{ margin: '0 0 6px' }}>{formatFullSchedule(hours, t).map((line) => <span key={line}>{line}</span>)}</div>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setModifierHoraires(true)}>✏️ {t('dashResto.editHours')}</button>
          </div>
        ) : <OpeningHoursEditor value={hours} onChange={setHours} />
      )}

      {cle === 'services' && (
        <div className="field services-choice">
          <label className="service-option"><input type="checkbox" checked={offersDelivery} onChange={(e) => setOffersDelivery(e.target.checked)} /> <span>🛵 {t('auth.serviceDelivery')}</span></label>
          {offersDelivery && (
            <div className="service-suboptions">
              <label htmlFor={ids + '-qui'}>{t('dashResto.whoDelivers')}</label>
              <select id={ids + '-qui'} value={deliveryModePref} onChange={(e) => setDeliveryModePref(e.target.value)}>
                <option value="fairide">{t('dashResto.fairidePool')}</option>
                <option value="own">{t('dashResto.ownDrivers')}</option>
              </select>
              {deliveryModePref === 'own' && <p className="small" style={{ margin: '6px 0 0' }}>{t('dashResto.ownDriversHelp')}</p>}
            </div>
          )}
          <label className="service-option"><input type="checkbox" checked={offersPickup} onChange={(e) => setOffersPickup(e.target.checked)} /> <span>🏠 {t('auth.servicePickup')}</span></label>
        </div>
      )}

      {cle === 'contact' && (
        <>
          <div className="field"><label htmlFor={ids + '-desc'}>{t('dashResto.description')}</label><textarea id={ids + '-desc'} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('dashResto.phDescription')} /></div>
          <div className="field">
            <label htmlFor={ids + '-tel'}>{t('dashResto.businessPhone')}</label>
            <input id={ids + '-tel'} type="tel" value={telephoneCommerce} onChange={(e) => setTelephoneCommerce(e.target.value)} placeholder="+32 2 000 00 00" />
          </div>
          <div className="field">
            <label htmlFor={ids + '-site'}>{t('dashResto.website')}</label>
            <input id={ids + '-site'} inputMode="url" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} placeholder="https://www.mon-commerce.be" />
          </div>
        </>
      )}

      <div className="auth-step-nav">
        {etape > 0 && <button type="button" className="btn-outline" onClick={() => setEtape(etape - 1)}>{t('auth.back')}</button>}
        <button type="submit" className="btn-gold" style={{ flex: 1 }} disabled={envoi}>
          {envoi ? '…' : derniere ? t('dashResto.createMyRestaurant') : t('auth.continueStep')}
        </button>
      </div>
    </form>
  );
}
