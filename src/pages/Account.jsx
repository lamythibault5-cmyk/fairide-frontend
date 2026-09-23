import { useEffect, useRef, useState, useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icone from '../components/Icone';
import PasswordInput from '../components/PasswordInput';
import PhoneVerification from '../components/PhoneVerification';
import DriverDocuments from '../components/DriverDocuments';
import DriverContractTerms from '../components/DriverContractTerms';
import RestaurantContract from '../components/RestaurantContract';
import PhoneInput from '../components/PhoneInput';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LigneCompte from '../components/LigneCompte';
import MesCasquettes from '../components/MesCasquettes';
import InboxSection from '../components/InboxSection';
import useInbox from '../hooks/useInbox';
import PaiementRestaurant from '../components/PaiementRestaurant';
import PaiementLivreur from '../components/PaiementLivreur';
import { abonnementOuvert, datePremierPrelevement } from '../launch';
import OffreFormules from '../components/OffreFormules';
import TerminalFairide from '../components/TerminalFairide';
import MyGuestReviews from '../components/MyGuestReviews';
import { StarsDisplay } from '../components/Stars';

// La page Mon compte : un menu de rangées (icône, titre, sous-titre, chevron) groupées en cartes, du
// même dessin partout. Une rangée mène soit à une page (lien), soit à une action (bouton), soit se
// DÉPLIE sur place pour montrer un formulaire — les infos, le mot de passe, la langue, le solde, le
// parrainage… Repliées par défaut : la page se lit d'un coup d'œil, chaque réglage est à un geste, et
// on n'a plus sept formulaires ouverts les uns sous les autres.
//
// Les valeurs restent en français (stockées telles quelles côté backend) — seul le libellé affiché
// est traduit, même principe que ROLES/GENDERS dans Auth.jsx.
function deletionReasons(t) {
  return [
    { value: "Je n'utilise plus le service", label: t('account.deletionReasons.notUsing') },
    { value: 'Prix ou frais trop élevés', label: t('account.deletionReasons.tooExpensive') },
    { value: 'Mauvaise expérience avec une commande', label: t('account.deletionReasons.badExperience') },
    { value: 'Problème avec un restaurant ou un livreur', label: t('account.deletionReasons.restaurantDriverIssue') },
    { value: 'Je préfère une autre application', label: t('account.deletionReasons.otherApp') },
    { value: 'Problème de confidentialité ou de sécurité', label: t('account.deletionReasons.privacySecurity') },
    { value: 'Autre raison', label: t('account.deletionReasons.other') }
  ];
}

function genders(t) {
  return [
    { value: '', label: t('auth.genderPlaceholder') },
    { value: 'Femme', label: t('auth.genderWoman') },
    { value: 'Homme', label: t('auth.genderMan') },
    { value: 'Autre', label: t('auth.genderOther') },
    { value: 'Préfère ne pas dire', label: t('auth.genderPreferNot') }
  ];
}

const LANGUE_LABEL = { fr: 'Français', en: 'English', nl: 'Nederlands' };

const ABONNEMENT_RESUME = {
  trialing: 'subTrialing', active: 'subActive', past_due: 'subPastDueShort', paused: 'subPausedShort', canceled: 'subCanceledShort', inactive: 'subNotVisible'
};

export default function Account() {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const { user, role, token, updateProfile, refreshUser, requestContactChange, confirmContactChange, requestDeletionCode, deleteAccount, logout } = useAuth();
  const toast = useToast();

  // Partage natif là où il existe (téléphones, Safari), presse-papiers ailleurs. Le refus de la
  // feuille de partage lève AbortError : ce n'est pas une panne, c'est un utilisateur qui a changé
  // d'avis — lui afficher une erreur serait lui reprocher son geste.
  async function partagerFairide() {
    const lien = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Fairide',
          text: t('accountUi.shareText'),
          url: lien
        });
        return;
      }
      await navigator.clipboard.writeText(lien);
      toast(t('accountUi.toastLinkCopied', { link: lien }));
    } catch (e) {
      if (e?.name === 'AbortError') return;
      toast(t('accountUi.toastShareUnavailable', { link: lien }));
    }
  }
  const { t, language, locale } = useLanguage();
  const DELETION_REASONS = deletionReasons(t);
  const GENDERS = genders(t);
  const [driverDeliveries, setDriverDeliveries] = useState(null);
  const [driverReviews, setDriverReviews] = useState(null);
  const [restoId, setRestoId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  // Reçus de la sous-section Paiement : toutes les commandes du restaurant, filtrées sur « payées » à l'affichage.
  const [commandesResto, setCommandesResto] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [subscribing, setSubscribing] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [pausingSub, setPausingSub] = useState(false);
  const [resumingSub, setResumingSub] = useState(false);
  const [cancelingSub, setCancelingSub] = useState(false);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);
  const [referralStats, setReferralStats] = useState(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [converting, setConverting] = useState(false);
  const [offersDelivery, setOffersDelivery] = useState(true);
  const [offersPickup, setOffersPickup] = useState(true);
  // À emporter : 'online' (en ligne seulement), 'on_site' (sur place seulement) ou 'both' (le client choisit).
  const [pickupPaymentMode, setPickupPaymentMode] = useState('online');
  const [offersDineIn, setOffersDineIn] = useState(true);
  const [savingServices, setSavingServices] = useState(false);
  const servicesInitRef = useRef(false);
  const [generatedCodes, setGeneratedCodes] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState(DELETION_REASONS[0].value);
  const [deleteComment, setDeleteComment] = useState('');
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [gender, setGender] = useState(user.gender || '');
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [addressStreet, setAddressStreet] = useState(user.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(user.addressNumber || '');
  const [addressPostalCode, setAddressPostalCode] = useState(user.addressPostalCode || '');
  const [addressCity, setAddressCity] = useState(user.addressCity || '');
  const [savingInfo, setSavingInfo] = useState(false);

  const [locationSharingEnabled, setLocationSharingEnabled] = useState(user.locationSharingEnabled !== false);
  const [savingLocationSharing, setSavingLocationSharing] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Les rangées dépliées. Plusieurs peuvent l'être à la fois : replier la précédente quand on en
  // ouvre une autre ferait disparaître ce qu'on était en train de comparer.
  // ?ouvrir=paiement (depuis le tableau de bord, par exemple) : la sous-section arrive déjà dépliée et à l'écran ;
  // ?retour=/dashboard ajoute un bouton pour revenir d'où l'on vient.
  const [searchParams] = useSearchParams();
  const sectionDemandee = searchParams.get('ouvrir') || '';
  const { unread: nonLus } = useInbox();
  const retour = /^\/[a-z0-9/_-]*$/i.test(searchParams.get('retour') || '') ? searchParams.get('retour') : '';
  const [ouvertes, setOuvertes] = useState(() => new Set(sectionDemandee ? [sectionDemandee] : []));
  // Le défilement doit ATTENDRE que la cible existe. Les trois ancres du restaurateur
  // (section-contrat, section-paiement, section-abonnement) ne sont rendues qu'une fois la fiche
  // du commerce chargée — deux appels enchaînés, /restaurants/mine/dashboard puis /restaurants/:id.
  // L'ancienne version cherchait l'ancre 150 ms après le montage, donc toujours avant la réponse du
  // serveur : getElementById renvoyait null, le défilement n'avait jamais lieu et la rangée dépliée
  // apparaissait tout en bas d'une page laissée en haut. Le restaurateur arrivait sur « Mes infos »
  // et croyait que le lien de la check-list ne menait nulle part (« Voir la formule → »).
  // On réessaie donc à chaque rendu tant que l'ancre est absente, et le repère évite de faire
  // redéfiler la page quand la fiche est rechargée après un enregistrement.
  const dejaDeroule = useRef(false);
  useEffect(() => {
    if (!sectionDemandee || dejaDeroule.current) return;
    const cible = document.getElementById(`section-${sectionDemandee}`);
    if (!cible) return; // fiche pas encore chargée : le rendu suivant repassera ici
    dejaDeroule.current = true;
    const id = setTimeout(() => cible.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(id);
  }, [sectionDemandee, restaurant, role]);
  function basculer(cle) {
    setOuvertes((prev) => { const n = new Set(prev); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  }
  // ouvrirAdresse() est partie avec la rangée « Adresse de livraison » qu'elle servait : elle
  // dépliait « Mes infos » et posait le curseur dans la rue. L'adresse se modifie maintenant là
  // où elle est écrite, sans détour.

  useEffect(() => {
    if (role !== 'driver') return;
    Promise.all([
      api('/orders/mine/deliveries', { token }),
      api('/reviews/driver/mine', { token })
    ]).then(([deliveries, reviews]) => {
      setDriverDeliveries(deliveries);
      setDriverReviews(reviews);
    }).catch((e) => toast(e.message, 'erreur'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Commercial Fairide ? (accès donné par l'admin dans Admin › Sales) : décide si la rubrique Sales apparaît. Clients seulement.
  const [salesEtat, setSalesEtat] = useState(null);
  useEffect(() => {
    if (role !== 'client') return;
    api('/sales/me', { token }).then(setSalesEtat).catch(() => setSalesEtat({ agent: false }));
  }, [role, token]);
  useEffect(() => {
    api('/auth/referral/mine', { token }).then(setReferralStats).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Commerce du compte (id, commandes) ; rappelé après un enregistrement depuis la sous-section Paiement.
  function rechargerRestaurant() {
    if (role !== 'restaurant') return;
    api('/restaurants/mine/dashboard', { token }).then((list) => {
      if (list[0]) {
        setRestoId(list[0].id);
        api(`/orders/restaurant/${list[0].id}`, { token }).then((rows) => setCommandesResto(Array.isArray(rows) ? rows : [])).catch(() => {});
        // Fiche à jour (numéros légaux, Stripe) même quand l'id n'a pas changé.
        api(`/restaurants/${list[0].id}`).then(setRestaurant).catch(() => {});
      }
    }).catch((e) => toast(e.message, 'erreur'));
  }
  useEffect(() => {
    if (role !== 'restaurant') return;
    rechargerRestaurant();
    if (new URLSearchParams(window.location.search).get('subscribed')) {
      toast(t('accountUi.toastSubActivating'));
      window.history.replaceState({}, '', '/account');
      setOuvertes((prev) => new Set(prev).add('abonnement'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (!restoId) return;
    refreshRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  useEffect(() => {
    if (role !== 'restaurant') return;
    const clock = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clock);
  }, [role]);

  function refreshRestaurant() {
    if (!restoId) return;
    api(`/restaurants/${restoId}`, { token }).then(setRestaurant).catch((e) => toast(e.message, 'erreur'));
  }

  // N'initialise les cases à cocher qu'une fois par restaurant, pas à chaque refreshRestaurant() (ex.
  // après une action sur l'abonnement) — sinon ça écraserait une modification en cours, non sauvegardée.
  useEffect(() => {
    if (!restaurant || servicesInitRef.current) return;
    servicesInitRef.current = true;
    // Le choix enregistré (wants*), pas ce qui est ouvert aux clients : sans abonnement actif, livraison et
    // emporter restent cochés ici mais fermés côté client (voir formules.js côté serveur).
    setOffersDelivery(restaurant.wantsDelivery ?? restaurant.offersDelivery);
    setOffersPickup(restaurant.wantsPickup ?? restaurant.offersPickup);
    setPickupPaymentMode(restaurant.pickupPaymentMode || (restaurant.pickupPayOnSite ? 'both' : 'online'));
    setOffersDineIn(restaurant.offersDineIn);
  }, [restaurant]);

  async function saveServices() {
    if (!offersDelivery && !offersPickup && !offersDineIn) {
      toast(t('accountUi.toastOneService'));
      return;
    }
    setSavingServices(true);
    try {
      await api(`/restaurants/${restoId}/services`, { method: 'PATCH', token, body: { offersDelivery, offersPickup, offersDineIn, pickupPaymentMode } });
      refreshRestaurant();
      toast(t('accountUi.toastServicesUpdated'));
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setSavingServices(false);
    }
  }

  // Depuis « Services proposés » : déplie l'abonnement et l'amène à l'écran.
  function voirAbonnement() {
    setOuvertes((prev) => new Set(prev).add('abonnement'));
    setTimeout(() => document.getElementById('section-abonnement')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  async function subscribeNow() {
    setSubscribing(true);
    try {
      const r = await api(`/restaurants/${restoId}/subscription/checkout`, { method: 'POST', token, body: { promoCode: promoCodeInput.trim() || undefined } });
      window.location.href = r.checkoutUrl;
    } catch (e) {
      toast(e.message, 'erreur');
      setSubscribing(false);
    }
  }

  async function pauseSubscription() {
    setPausingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/pause`, { method: 'POST', token });
      refreshRestaurant();
      toast(t('accountUi.toastSubPaused'));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setPausingSub(false);
    }
  }

  async function resumeSubscription() {
    setResumingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/resume`, { method: 'POST', token });
      refreshRestaurant();
      toast(t('accountUi.toastSubResumed'));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setResumingSub(false);
    }
  }

  async function cancelSubscription() {
    setCancelingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/cancel`, { method: 'POST', token });
      refreshRestaurant();
      setConfirmCancelSub(false);
      toast(t('accountUi.toastSubCanceled'));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setCancelingSub(false);
    }
  }

  useEffect(() => {
    if (role !== 'restaurant' && role !== 'driver') return;
    api('/auth/balance/codes/mine', { token }).then(setGeneratedCodes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function copyReferralCode() {
    if (!referralStats?.code) return;
    navigator.clipboard.writeText(referralStats.code).then(() => {
      toast(t('account.referral.toastCopied'));
    }).catch(() => {});
  }

  async function handleRedeemCode(e) {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      const result = await api('/auth/balance/redeem', { method: 'POST', token, body: { code: redeemCode.trim() } });
      toast(t('account.redeemSuccess', { amount: Number(result.amount).toFixed(2) }));
      setRedeemCode('');
      await refreshUser();
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setRedeeming(false);
    }
  }

  async function handleConvert(e) {
    e.preventDefault();
    const amount = Number(convertAmount);
    if (!amount || amount <= 0) return;
    setConverting(true);
    try {
      const result = await api('/auth/balance/convert', { method: 'POST', token, body: { amount } });
      toast(t('account.convert.toastSuccess', { code: result.code }));
      setConvertAmount('');
      setGeneratedCodes((prev) => [{ code: result.code, amount: Number(result.amount), used: false, createdAt: new Date().toISOString() }, ...(prev || [])]);
      await refreshUser();
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setConverting(false);
    }
  }

  async function toggleLocationSharing(e) {
    const next = e.target.checked;
    setLocationSharingEnabled(next);
    setSavingLocationSharing(true);
    try {
      await updateProfile({ locationSharingEnabled: next });
      toast(next ? t('account.toastGeoOn') : t('account.toastGeoOff'));
    } catch (err) {
      setLocationSharingEnabled(!next);
      toast(err.message, 'erreur');
    } finally {
      setSavingLocationSharing(false);
    }
  }

  async function saveInfo(e) {
    e.preventDefault();
    setSavingInfo(true);
    try {
      await updateProfile({
        firstName: firstName.trim(), lastName: lastName.trim(),
        gender, birthDate: birthDate || '',
        addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
        addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim()
      });
      toast(t('account.toastInfoUpdated'));
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleSendDeleteCode() {
    setSendingCode(true);
    try {
      await requestDeletionCode();
      setDeleteCodeSent(true);
      toast(t('account.toastDeleteCodeSent'));
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setSendingCode(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteCode) { toast(t('account.toastDeleteCodeRequired')); return; }
    setDeleting(true);
    try {
      const result = await deleteAccount({ code: deleteCode, reason: deleteReason, comment: deleteComment.trim() });
      toast(result.anonymized ? t('account.toastAccountDeletedAnon') : t('account.toastAccountDeleted'));
    } catch (err) {
      toast(err.message, 'erreur');
      setDeleting(false);
    }
  }

  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  async function savePassword(e) {
    e.preventDefault();
    // Même règle que le serveur (routes/auth.js) : longueur ET casse. Ne contrôler que la longueur
    // ici laissait passer un mot de passe que l'enregistrement refusait ensuite en 400.
    if (newPassword.length < 6 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)) { toast(t('account.toastPasswordTooShort')); return; }
    if (newPasswordConfirm !== newPassword) { toast(t('auth.errPasswordMismatch'), 'erreur'); return; }
    setSavingPassword(true);
    try {
      await updateProfile({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword(''); setNewPasswordConfirm('');
      toast(t('account.toastPasswordChanged'));
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setSavingPassword(false);
    }
  }

  const nomComplet = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initiales = (nomComplet || user.email || '?').split(/[\s@]+/).slice(0, 2).map((m) => m[0]).join('').toUpperCase();

  // Les trois raccourcis de l'en-tête, par rôle. Ils ne créent aucune destination : ce sont des
  // pages qui existent déjà et qu'on atteignait par une rangée plus bas ou par la barre du bas.
  const raccourcis = role === 'client'
    ? [{ to: '/favorites', icone: 'favoris', libelle: t('nav.favorites') },
       { to: '/orders', icone: 'commandes', libelle: t('nav.orders') },
       { to: '/invoices', icone: 'document', libelle: t('accountUi.myInvoices') }]
    : role === 'driver'
      ? [{ to: '/driver', icone: 'commandes', libelle: t('nav.orders') },
         { to: '/driver/reviews', icone: 'etoile', libelle: t('accountUi.myReviews') },
         { to: '/driver/invoices', icone: 'document', libelle: t('accountUi.myInvoices') }]
      : [{ to: '/dashboard/orders', icone: 'commandes', libelle: t('nav.orders') },
         { to: '/dashboard/preview', icone: 'apercu', libelle: t('nav.customerPreview') },
         { to: '/dashboard/invoices', icone: 'document', libelle: t('accountUi.myInvoices') }];
  const adresseResume = user.addressStreet && user.addressCity ? `${user.addressStreet} ${user.addressNumber || ''}, ${user.addressCity}`.replace(' ,', ',') : null;
  const solde = Number(user.balance || 0).toFixed(2);

  return (
    <div>
      {/* LE NOM EST LE TITRE DE LA PAGE. « Mon compte » au-dessus d'une carte qui répétait le nom,
          l'e-mail et le rôle faisait deux en-têtes pour une seule page — et « Mon compte » ne dit
          rien que l'onglet allumé en bas ne dise déjà. Le nom, lui, confirme d'un coup d'œil sous
          quel compte on est, ce qui est la vraie question quand on ouvre cet écran. */}
      <div className="account-entete">
        <h1 className="page-title account-entete-nom">{nomComplet || user.email}</h1>
        <span className="account-avatar account-avatar-grand" aria-hidden="true">{initiales}</span>
      </div>

      {/* Trois raccourcis vers ce qu'on vient chercher le plus souvent : le reste de la page est
          une liste de réglages, qu'on ouvre rarement. Ils dépendent du rôle — un livreur n'a pas
          de favoris, un restaurateur n'a pas de commandes à lui. */}
      <div className="account-raccourcis">
        {raccourcis.map((r) => (
          <Link key={r.to} to={r.to} className="account-raccourci">
            <Icone nom={r.icone} taille={24} />
            <span>{r.libelle}</span>
          </Link>
        ))}
      </div>

      {/* ——— Messages : en tête, juste sous l'identité — c'est par là que Fairide parle aux comptes
          (annonces, réponses), avec le compteur de non-lus. /account?ouvrir=messages arrive dessus déplié. ——— */}
      <div className={`card account-groupe account-groupe-messages${nonLus > 0 ? ' a-non-lus' : ''}`} aria-label={t('inbox.rowTitle')}>
        <div id="section-messages">
          {/* Le sous-titre ne s'affiche QUE s'il y a des messages non lus : ça, c'est une
              information. « Les réponses de l'équipe » sous un titre « Messages » n'en était pas
              une, c'était le titre écrit deux fois. */}
          <LigneCompte icone="courrier" titre={t('inbox.rowTitle')} sous={nonLus > 0 ? t('inbox.rowSubUnread', { n: nonLus }) : undefined} accent={nonLus > 0 ? 'warn' : undefined} ouverte={ouvertes.has('messages')} onClick={() => basculer('messages')}>
            {ouvertes.has('messages') && <InboxSection />}
          </LigneCompte>
        </div>
      </div>

      {/* ——— Mon profil : tout ce qui décrit la personne et son accès. ——— */}
      <div className="card account-groupe" aria-label={t('accountUi.myProfile')}>
        <LigneCompte icone="compte" titre={t('accountUi.myInfo')} sous={adresseResume || t('accountUi.profileSub')} ouverte={ouvertes.has('infos')} onClick={() => basculer('infos')}>
          <form onSubmit={saveInfo}>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={idsA11y + '-firstname'}>{t('auth.firstName')}</label>
                <input id={idsA11y + '-firstname'} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={idsA11y + '-lastname'}>{t('auth.lastName')}</label>
                <input id={idsA11y + '-lastname'} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={idsA11y + '-gender'}>{t('auth.gender')}</label>
                <select id={idsA11y + '-gender'} value={gender} onChange={(e) => setGender(e.target.value)}>
                  {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={idsA11y + '-birthdate'}>{t('account.birthDate')}</label>
                <input id={idsA11y + '-birthdate'} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="champ-adresse">{t('auth.street')}</label>
                <input id="champ-adresse" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={idsA11y + '-number'}>{t('auth.number')}</label>
                <input id={idsA11y + '-number'} value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={idsA11y + '-postalcode'}>{t('auth.postalCode')}</label>
                <input id={idsA11y + '-postalcode'} value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor={idsA11y + '-city'}>{t('auth.city')}</label>
                <input id={idsA11y + '-city'} value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-teal" disabled={savingInfo}>{savingInfo ? '...' : t('common.save')}</button>
          </form>

          {/* Supprimer le compte : au bout des infos personnelles, puisque c'est d'elles qu'il s'agit.
              Séparé par un filet et discret tant qu'on ne l'a pas demandé — on ne met pas un bouton
              rouge en pleine page pour un geste qu'on fait une fois. */}
          <div className="account-zone-danger">
            <b className="account-zone-danger-titre">{t('account.deleteTitle')}</b>
            {!confirmDeleteOpen && (
              <button type="button" className="btn-danger-ghost" onClick={() => setConfirmDeleteOpen(true)}>{t('account.deleteButton')}</button>
            )}
            {confirmDeleteOpen && (
              <div>
                <p className="small" style={{ color: 'var(--red)', marginBottom: 10 }}>{t('account.deleteWarning')}</p>
                {!deleteCodeSent && (
                  <>
                    <div className="field">
                      <label htmlFor={idsA11y + '-deletewhy'}>{t('account.deleteWhy')}</label>
                      <select id={idsA11y + '-deletewhy'} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                        {DELETION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={idsA11y + '-deletecomment'}>{t('account.deleteComment')}</label>
                      <input id={idsA11y + '-deletecomment'} value={deleteComment} onChange={(e) => setDeleteComment(e.target.value)} placeholder={t('account.deleteCommentPlaceholder')} />
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={sendingCode} onClick={handleSendDeleteCode}>
                        {sendingCode ? '...' : t('account.deleteRequestCode')}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setConfirmDeleteOpen(false)}>{t('common.cancel')}</button>
                    </div>
                  </>
                )}
                {deleteCodeSent && (
                  <>
                    <p className="small" style={{ marginBottom: 10 }}>
                      {role === 'client' ? t('account.deleteCodeSentText') : t('account.deleteCodeSentTextAdmin')}
                    </p>
                    <div className="field">
                      <label htmlFor={idsA11y + '-deletecodelabel'}>{t('account.deleteCodeLabel')}</label>
                      <input id={idsA11y + '-deletecodelabel'} value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder="123456" maxLength={6} />
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={deleting} onClick={handleDeleteAccount}>
                        {deleting ? '...' : t('account.deleteConfirmFinal')}
                      </button>
                      <button type="button" className="btn-ghost" disabled={sendingCode} onClick={handleSendDeleteCode}>{t('auth.resendCode')}</button>
                      <button type="button" className="btn-ghost" onClick={() => { setConfirmDeleteOpen(false); setDeleteCodeSent(false); setDeleteCode(''); }}>{t('common.cancel')}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </LigneCompte>

        {/* Le sous-titre tenait e-mail + téléphone + « téléphone à vérifier » sur une seule ligne :
            tronqué à l'ellipse sur un téléphone, il finissait par cacher l'avertissement même qu'il
            portait. L'e-mail suffit à identifier la rangée, et l'alerte de vérification passe seule
            quand elle a lieu d'être — c'est la seule des trois informations qui appelle une action. */}
        <LigneCompte icone="cadenas" titre={t('accountUi.loginDetails')} sous={user.phone && !user.phoneVerified ? t('accountUi.phoneNotVerifiedShort') : user.email} ouverte={ouvertes.has('connexion')} onClick={() => basculer('connexion')}>
          <p className="small" style={{ margin: '0 0 6px', opacity: 0.75 }}>
            {t('accountUi.contactCodeInfo')}
          </p>
          <ContactChangeField
            field="email" label={t('accountUi.emailAddress')} currentValue={user.email} type="email" placeholder={t('accountUi.phNewEmail')}
            requestContactChange={requestContactChange} confirmContactChange={confirmContactChange} toast={toast}
          />
          <div className="divider" style={{ margin: '4px 0' }} />
          <ContactChangeField
            field="phone" label={t('accountUi.phoneNumber')} currentValue={user.phone} type="tel" placeholder={t('accountUi.phPhone')}
            requestContactChange={requestContactChange} confirmContactChange={confirmContactChange} toast={toast}
          />
          <PhoneVerification />
        </LigneCompte>

        <LigneCompte icone="cle" titre={t('account.passwordTitle')} ouverte={ouvertes.has('mdp')} onClick={() => basculer('mdp')}>
          <form onSubmit={savePassword}>
            <div className="field">
              <label htmlFor="mdp-actuel">{t('account.currentPassword')}</label>
              <PasswordInput id="mdp-actuel" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="mdp-nouveau">{t('account.newPassword')}</label>
              <PasswordInput id="mdp-nouveau" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('account.newPasswordPlaceholder')} />
            </div>
            <div className="field">
              <label htmlFor="mdp-confirme">{t('auth.passwordConfirm')}</label>
              <PasswordInput id="mdp-confirme" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder={t('auth.phPasswordConfirm')} />
            </div>
            <button type="submit" className="btn-outline" disabled={savingPassword}>{savingPassword ? '...' : t('account.changePassword')}</button>
          </form>
        </LigneCompte>

        {/* Langue de l'interface. Elle vivait dans la barre latérale, où elle était visible en permanence
            — mais une barre de navigation n'est pas l'endroit d'un réglage. Le choix est mémorisé dans
            localStorage (voir LanguageContext) : on ne le règle qu'une fois. Sa place est donc ici. */}
        <LigneCompte icone="globe" titre={t('account.language')} sous={LANGUE_LABEL[language] || language} ouverte={ouvertes.has('langue')} onClick={() => basculer('langue')}>
          <p className="small" style={{ margin: '0 0 10px', opacity: 0.75 }}>{t('account.languageHelp')}</p>
          <LanguageSwitcher />
        </LigneCompte>

        {role === 'driver' && (
          <LigneCompte icone="dossier" titre={t('driverDocs.title')} sous={t('driverDocs.sub')} ouverte={ouvertes.has('documents')} onClick={() => basculer('documents')}>
            {ouvertes.has('documents') && <DriverDocuments />}
          </LigneCompte>
        )}
        {role === 'driver' && (
          <LigneCompte icone="antenne" titre={t('account.geoTitle')} sous={locationSharingEnabled ? t('accountUi.sharingOn') : t('accountUi.sharingOff')} ouverte={ouvertes.has('geo')} onClick={() => basculer('geo')}>
            <p className="small" style={{ margin: '0 0 10px' }}>{t('account.geoExplain')}</p>
            <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={locationSharingEnabled} disabled={savingLocationSharing} onChange={toggleLocationSharing} />
              <span className="small">{t('account.geoToggleLabel')}</span>
            </label>
          </LigneCompte>
        )}
      </div>

      {/* ——— Solde et avantages. ——— */}
      <div className="card account-groupe" aria-label={t('accountUi.balanceBenefits')}>
        {role === 'client' && (
          <LigneCompte icone="solde" titre={t('accountUi.myBalance')} sous={t('accountUi.balanceSub', { balance: solde })} ouverte={ouvertes.has('solde')} onClick={() => basculer('solde')}>
            <div className="stat-card highlight" style={{ marginBottom: 14 }}>
              <div className="num">{solde}€</div>
              <div className="label">{t('account.balance')}</div>
            </div>
            <form onSubmit={handleRedeemCode} className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder={t('account.redeemPlaceholder')} />
              </div>
              <button type="submit" className="btn-teal" disabled={redeeming}>{redeeming ? '...' : t('account.redeemButton')}</button>
            </form>
          </LigneCompte>
        )}

        {/* Icône différente de celle de « Mon solde » juste au-dessus : les deux rangées se suivent,
            et le même 💰 sur les deux les faisait lire comme une seule répétée. */}
        {(role === 'restaurant' || role === 'driver') && (
          <LigneCompte icone="banque" titre={t('account.convert.title')} sous={`${solde}€ disponibles`} ouverte={ouvertes.has('convertir')} onClick={() => basculer('convertir')}>
            <p className="small" style={{ margin: '0 0 12px' }}>{t('account.convert.explain')}</p>
            <div className="stat-card highlight" style={{ marginBottom: 14 }}>
              <div className="num">{solde}€</div>
              <div className="label">{t('account.convert.balanceLabel')}</div>
            </div>
            <form onSubmit={handleConvert} className="row" style={{ gap: 8, marginBottom: generatedCodes?.length ? 14 : 0 }}>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <input type="number" step="0.01" min="5" value={convertAmount} onChange={(e) => setConvertAmount(e.target.value)} placeholder={t('account.convert.amountPlaceholder')} />
              </div>
              <button type="submit" className="btn-teal" disabled={converting}>{converting ? '...' : t('account.convert.button')}</button>
            </form>
            {generatedCodes && generatedCodes.length > 0 && (
              <div>
                <div className="small" style={{ margin: '4px 0 6px', fontWeight: 600 }}>{t('account.convert.myCodes')}</div>
                {generatedCodes.map((c) => (
                  <div key={c.code} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontWeight: 700, letterSpacing: 1 }}>{c.code}</span>
                    <span className="small">{c.amount.toFixed(2)}€</span>
                    <span className={`pill ${c.used ? '' : 'teal'}`}>{c.used ? t('account.convert.used') : t('account.convert.unused')}</span>
                  </div>
                ))}
              </div>
            )}
          </LigneCompte>
        )}

        {/* Sans code de parrainage (comptes créés avant que les codes existent, comptes de
            démonstration), le résumé s'affichait « Ton code : · 0.00€ gagnés » — un deux-points
            suivi d'un point médian, sans rien entre les deux. On retombe alors sur la phrase
            d'invitation, qui reste vraie quoi qu'il arrive. */}
        <LigneCompte icone="cadeau" titre={t('account.referral.title')} sous={referralStats && referralStats.code ? t('accountUi.referralSummary', { code: referralStats.code, earned: referralStats.earnedTotal.toFixed(2) }) : t('accountUi.referralSub')} ouverte={ouvertes.has('parrainage')} onClick={() => basculer('parrainage')}>
          <p className="small" style={{ margin: '0 0 12px' }}>{t(`account.referral.how.${role}`)}</p>
          {referralStats && (
            <>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <input readOnly value={referralStats.code} style={{ fontWeight: 700, letterSpacing: 1 }} />
                </div>
                <button type="button" className="btn-teal" onClick={copyReferralCode}>{t('account.referral.copy')}</button>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="num">{referralStats.referredCount}</div>
                  <div className="label">{t('account.referral.statInvited')}</div>
                </div>
                <div className="stat-card highlight" style={{ flex: 1 }}>
                  <div className="num">{referralStats.earnedTotal.toFixed(2)}€</div>
                  <div className="label">{t('account.referral.statEarned')}</div>
                </div>
              </div>
              {referralStats.pendingCount > 0 && (
                <p className="small" style={{ margin: '10px 0 0' }}>{t('account.referral.pending', { count: referralStats.pendingCount })}</p>
              )}
              <p className="small" style={{ margin: '10px 0 0', opacity: 0.75 }}>{t('account.referral.spendOnly')}</p>
            </>
          )}
        </LigneCompte>
      </div>

      {/* ——— Selon le rôle. Une rubrique ne figure qu'à UN endroit : ce qui est dans la barre du bas
          (restaurants, recherche, commandes, favoris, carte) n'est pas repris ici. ———
          Client : « Moyens de paiement » et « Titres restaurant » mènent à une réponse écrite, pas à un
          réglage — Fairide n'enregistre pas de carte et n'accepte pas encore les titres-restaurant. */}
      {role === 'client' && (
        <div className="card account-groupe" aria-label={t('accountUi.ordersAndFairide')}>
          {/* Les favoris ont quitté la barre du bas, ramenée à cinq onglets pour que chaque cible
              fasse 56px (voir DashboardSidebar.jsx). On les ouvre moins souvent que la liste, la
              recherche ou ses commandes — c'est le sixième par l'usage, donc celui qui part. */}
          <LigneCompte icone="bouclier" titre={t('accountUi.guestReviewsTitle')} ouverte={ouvertes.has('avisRestos')} onClick={() => basculer('avisRestos')}>
            {ouvertes.has('avisRestos') && <MyGuestReviews />}
          </LigneCompte>
          {/* La rangée « Adresse de livraison » a disparu : elle affichait mot pour mot l'adresse déjà
              écrite sous « Mes infos », deux blocs plus haut, et menait au même endroit — la même
              donnée, présentée deux fois comme deux réglages différents. Fairide ne retient qu'UNE
              adresse ; elle vit donc à un seul endroit, sous « Mes infos », où elle se modifie. */}
          <LigneCompte to="/aide?sujet=paiement" icone="carteBancaire" titre={t('accountUi.paymentMethods')} />
          <LigneCompte to="/aide?sujet=titres-restaurant" icone="ticket" titre={t('accountUi.mealVouchers')} sous={t('accountUi.mealVouchersSub')} />
          <LigneCompte to="/notre-histoire" icone="boussole" titre={t('accountUi.ourStory')} />
          {/* Les mini-jeux ont quitté « Mes commandes » pour cette rubrique, juste après l'histoire. */}
          <LigneCompte to="/jeux" icone="manette" titre={t('accountUi.games')} sous={t('accountUi.gamesSub')} />
          {/* Commerciaux Fairide (routes/adminSales.js) : la rubrique Sales n'apparaît que si l'admin a donné l'accès à ce compte
              (Admin › Sales). Rien d'autre n'est affiché — un compte client ordinaire ne voit jamais cette page. */}
          {salesEtat?.agent && (
            <LigneCompte to="/sales" icone="stats" titre={t('accountUi.salesCrmRow')} sous={t('accountUi.salesCrmSub', { n: salesEtat.stats?.total ?? 0 })} />
          )}
        </div>
      )}

      {role === 'restaurant' && restaurant && (
        <div className="card account-groupe" aria-label={t('accountUi.myBusiness')}>
          {/* « Aperçu client » et « Carte » ont quitté la barre du bas, ramenée à cinq onglets pour
              que chaque cible fasse 56px (voir DashboardSidebar.jsx). Ce sont des pages qu'on ouvre
              de temps en temps, pas au service : elles rejoignent ici Promotions, Factures et Mode
              d'emploi, partis avant elles pour la même raison. */}
          <LigneCompte to="/dashboard/map" icone="carte" titre={t('nav.map')} />
          {/* Le terminal Fairide : statut tenu par l'équipe (admin), caution, dates. Version gratuite : rien à faire. */}
          {restaurant.terminal && (
            <LigneCompte icone="imprimante" titre={t('accountUi.terminalRow')} sous={t(`accountUi.terminalSub_${restaurant.terminal.status}`, { amount: Number(restaurant.terminal.depositAmount || 80).toFixed(0) })} ouverte={ouvertes.has('terminal')} onClick={() => basculer('terminal')}>
            {ouvertes.has('terminal') && <TerminalFairide terminal={restaurant.terminal} />}
            </LigneCompte>
          )}
          <div id="section-contrat" />
          <LigneCompte icone="contrat" titre={t('restoContract.rowTitle')} sous={t('restoContract.rowSub')} ouverte={ouvertes.has('contrat')} onClick={() => basculer('contrat')}>
            {ouvertes.has('contrat') && <RestaurantContract restoId={restaurant.id} onAccepte={rechargerRestaurant} />}
          </LigneCompte>
          <div id="section-paiement">
            <LigneCompte icone="euro" titre={t('accountUi.paymentRow')} sous={restaurant.stripeConnectStatus === 'active' ? t('accountUi.paymentRowSubActive') : restaurant.plan === 'reservation' ? t('accountUi.paymentRowSubOptional') : t('accountUi.paymentRowSub')} ouverte={ouvertes.has('paiement')} onClick={() => basculer('paiement')}>
              {retour && <Link to={retour} className="btn-ghost" style={{ display: 'inline-block', marginBottom: 10, padding: '6px 10px', fontSize: 13 }}>← {t('accountUi.backToDashboard')}</Link>}
              <PaiementRestaurant restaurant={restaurant} orders={commandesResto} onRestaurantChange={rechargerRestaurant} />
            </LigneCompte>
          </div>
          {/* Version gratuite (plan « reservation » côté serveur : réservations, à emporter payé sur place) : aucun abonnement
              à activer. Il n'est jamais activé d'office, même avec tous les services cochés : c'est le restaurateur qui le fait. */}
          <div id="section-abonnement">
          <LigneCompte icone="carteBancaire" titre={t('accountUi.subscription')} sous={restaurant.plan === 'reservation' && ['inactive', 'canceled'].includes(restaurant.subscriptionStatus) ? t('accountUi.subNotNeeded') : ABONNEMENT_RESUME[restaurant.subscriptionStatus] ? t(`accountUi.${ABONNEMENT_RESUME[restaurant.subscriptionStatus]}`) : restaurant.subscriptionStatus} ouverte={ouvertes.has('abonnement')} onClick={() => basculer('abonnement')}>
            <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>
              {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
            </p>
            {restaurant.subscriptionStatus === 'trialing' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t('accountUi.subTrialIntro')}
                {restaurant.subscriptionCurrentPeriodEnd ? t('accountUi.subFirstCharge', { date: new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) }) : '.'}
              </p>
            )}
            {restaurant.subscriptionStatus === 'active' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t('accountUi.subVisibleIntro')}
                {restaurant.subscriptionCurrentPeriodEnd ? t('accountUi.subNextCharge', { date: new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) }) : ''}
              </p>
            )}
            {/* Sans abonnement actif, la réservation de table reste en ligne : seuls livraison et emporter s'arrêtent. */}
            {restaurant.subscriptionStatus === 'past_due' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t(restaurant.offersDineIn ? 'accountUi.subPastDueResa' : 'accountUi.subPastDue')}
              </p>
            )}
            {restaurant.subscriptionStatus === 'paused' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t(restaurant.offersDineIn ? 'accountUi.subPausedResa' : 'accountUi.subPaused')}
              </p>
            )}
            {restaurant.plan === 'reservation' && ['inactive', 'canceled'].includes(restaurant.subscriptionStatus) && (
              <div className="paiement-encart" style={{ marginBottom: 12 }}>
                <b>{t('accountUi.planReservationTitle')}</b>
                <p className="small" style={{ margin: '4px 0 0' }}>{t('accountUi.subNotNeededText')}</p>
              </div>
            )}
            {restaurant.subscriptionStatus === 'canceled' && restaurant.plan !== 'reservation' && (
              <p className="small" style={{ margin: '0 0 12px' }}>{t(restaurant.offersDineIn ? 'accountUi.subCanceledResa' : 'accountUi.subCanceled')}</p>
            )}
            {restaurant.subscriptionStatus === 'inactive' && restaurant.plan !== 'reservation' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t('accountUi.subInactiveIntro')}
                {' '}{t('accountUi.subPendingValidation', { date: datePremierPrelevement().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
              </p>
            )}

            {/* Aucun abonnement à activer avant la sortie de l'application (6 octobre 2026) : le bouton
                d'abonnement reviendra à ce moment-là (voir aussi le serveur, qui refuse l'activation avant
                la date d'ouverture). Le premier mois est offert quoi qu'il arrive. */}
            {['inactive', 'canceled'].includes(restaurant.subscriptionStatus) && restaurant.plan !== 'reservation' && !abonnementOuvert() && (
              <div className="paiement-encart" style={{ marginBottom: 12 }}>
                <b>{t('accountUi.subNotYetTitle')}</b>
                <p className="small" style={{ margin: '4px 0 0' }}>{t('accountUi.subNotYetText')}</p>
              </div>
            )}
            {/* Contrat d'abord : l'abonnement ne s'active qu'une fois la version en vigueur lue et acceptée (serveur : 409 CONTRACT_REQUIRED). */}
            {['inactive', 'canceled'].includes(restaurant.subscriptionStatus) && restaurant.plan !== 'reservation' && !restaurant.isDemo && restaurant.onboarding && !restaurant.onboarding.contractAccepted && (
              <div className="paiement-encart" style={{ marginBottom: 12 }}>
                <b>📜 {t('accountUi.subContractTitle')}</b>
                <p className="small" style={{ margin: '4px 0 8px' }}>{t('accountUi.subContractText')}</p>
                <button type="button" className="btn-gold" onClick={() => { setOuvertes((prev) => new Set(prev).add('contrat')); setTimeout(() => document.getElementById('section-contrat')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120); }}>{t('accountUi.subContractBtn')}</button>
              </div>
            )}
            {/* Fiche pas encore validée : le bouton d'abonnement ci-dessous exige adminStatus === 'approved', et
                sans ce mot la rangée se terminait sur du vide, sans jamais dire ce qui manquait. */}
            {['inactive', 'canceled'].includes(restaurant.subscriptionStatus) && restaurant.plan !== 'reservation' && abonnementOuvert() && restaurant.adminStatus !== 'approved' && (
              <div className="paiement-encart" style={{ marginBottom: 12 }}>
                <b>{t(restaurant.adminStatus === 'blocked' ? 'accountUi.subBlockedTitle' : 'accountUi.subPendingApprovalTitle')}</b>
                <p className="small" style={{ margin: '4px 0 0' }}>{t(restaurant.adminStatus === 'blocked' ? 'accountUi.subBlockedText' : 'accountUi.subPendingApprovalText')}</p>
              </div>
            )}
            {/* Bouton d'abonnement : impayé à régulariser, ou, dès le 6 octobre, formule complète pas encore abonnée (contrat accepté). */}
            {(restaurant.subscriptionStatus === 'past_due' || (['inactive', 'canceled'].includes(restaurant.subscriptionStatus) && restaurant.plan !== 'reservation' && abonnementOuvert() && (restaurant.isDemo || !restaurant.onboarding || restaurant.onboarding.contractAccepted))) && restaurant.adminStatus === 'approved' && (
              <div>
                <div className="field" style={{ maxWidth: 260 }}>
                  <label htmlFor={idsA11y + '-promocode'}>{t('auth.promoCode')}</label>
                  <input id={idsA11y + '-promocode'} value={promoCodeInput} onChange={(e) => setPromoCodeInput(e.target.value)} placeholder={t('auth.promoCodePlaceholder')} />
                </div>
                <button className="btn-gold" disabled={subscribing} onClick={subscribeNow}>
                  {subscribing ? '...' : t('accountUi.subscribeBtn', { months: t('accountUi.firstMonthFree') })}
                </button>
              </div>
            )}
            {['trialing', 'active', 'past_due'].includes(restaurant.subscriptionStatus) && (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-ghost" disabled={pausingSub} onClick={pauseSubscription}>{pausingSub ? '...' : t('accountUi.pauseSub')}</button>
                {!confirmCancelSub && (
                  <button className="btn-danger-ghost" onClick={() => setConfirmCancelSub(true)}>{t('accountUi.cancelSub')}</button>
                )}
              </div>
            )}
            {restaurant.subscriptionStatus === 'paused' && (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-teal" disabled={resumingSub} onClick={resumeSubscription}>{resumingSub ? '...' : t('accountUi.resumeSub')}</button>
                {!confirmCancelSub && (
                  <button className="btn-danger-ghost" onClick={() => setConfirmCancelSub(true)}>{t('accountUi.cancelSub')}</button>
                )}
              </div>
            )}
            {confirmCancelSub && (
              <div style={{ marginTop: 10 }}>
                <p className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>
                  {t('accountUi.cancelSubConfirm')}
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={cancelingSub} onClick={cancelSubscription}>
                    {cancelingSub ? '...' : t('accountUi.yesCancel')}
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmCancelSub(false)}>{t('accountUi.cancel')}</button>
                </div>
              </div>
            )}
          </LigneCompte>
          </div>

          <LigneCompte
            icone="cloche" titre={t('accountUi.servicesOffered')}
            sous={[offersDelivery && t('accountUi.delivery'), offersPickup && t('accountUi.pickup'), offersDineIn && t('accountUi.reservation')].filter(Boolean).join(' · ') || t('accountUi.noActiveService')}
            ouverte={ouvertes.has('services')} onClick={() => basculer('services')}
          >
            <p className="small" style={{ margin: '0 0 12px' }}>
              {t('accountUi.servicesIntro')}
            </p>
            {/* La version suit les cases, avant même d'enregistrer : réservation de table seule = gratuit ; à emporter (quel
                que soit son mode de paiement) ou livraison = version complète (même règle que formules.js côté serveur).
                Sans abonnement actif, le choix est gardé et s'ouvrira à son activation. */}
            {(() => {
              const complete = offersDelivery || offersPickup;
              const abonne = restaurant.isDemo || ['trialing', 'active'].includes(restaurant.subscriptionStatus);
              return (
                <div className="paiement-encart" style={{ marginBottom: 12 }}>
                  <b>{t(complete ? 'accountUi.planCompleteTitle' : 'accountUi.planReservationTitle')}</b>
                  {complete && !abonne && (
                    <p className="small" style={{ margin: '4px 0 8px' }}>
                      <b>{t('accountUi.planNeedsSubTitle')}</b><br />
                      {t('accountUi.planNeedsSubText')}
                    </p>
                  )}
                  <OffreFormules payant={complete} statut={restaurant.isDemo ? null : restaurant.subscriptionStatus} finEssai={restaurant.subscriptionCurrentPeriodEnd} onActiver={complete && !abonne ? voirAbonnement : null} />
                </div>
              );
            })()}
            <div className="service-table-wrap">
              <table className="service-table">
                <thead>
                  <tr><th>{t('accountUi.service')}</th><th className="col-actif">{t('accountUi.offered')}</th><th>{t('accountUi.whatChanges')}</th></tr>
                </thead>
                <tbody>
                  {[
                    { cle: 'delivery', icone: '🚴', nom: t('accountUi.delivery'), valeur: offersDelivery, set: setOffersDelivery,
                      effet: t('accountUi.svcDeliveryDesc') },
                    { cle: 'pickup', icone: '🥡', nom: t('accountUi.pickup'), valeur: offersPickup, set: setOffersPickup,
                      effet: t('accountUi.svcPickupDesc') },
                    { cle: 'dine_in', icone: 'restaurants', nom: t('accountUi.svcReservation'), valeur: offersDineIn, set: setOffersDineIn,
                      effet: t('accountUi.svcReservationDesc') }
                  ].map((s) => (
                    <tr key={s.cle} className={s.valeur ? '' : 'service-off'}>
                      <td><b>{s.icone} {s.nom}</b></td>
                      <td className="col-actif">
                        {/* Le libellé rend toute la cellule cliquable, et nomme la case pour un lecteur d'écran :
                            une case seule n'annoncerait que « coché », sans dire de quel service il s'agit. */}
                        <label className="service-toggle">
                          <input type="checkbox" checked={s.valeur} disabled={savingServices} onChange={(e) => s.set(e.target.checked)} />
                          <span className="sr-only">{s.nom}</span>
                        </label>
                      </td>
                      <td className="small">{s.valeur ? s.effet : <i>{t('accountUi.notOffered')}</i>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {offersPickup && (
              <fieldset className="paiement-encart" style={{ margin: '12px 0', border: 0 }}>
                <legend style={{ fontWeight: 700, padding: 0, marginBottom: 6 }}>💶 {t('accountUi.pickupPayTitle')}</legend>
                {[
                  { v: 'online', titre: t('accountUi.pickupPayOnline'), texte: t('accountUi.pickupPayOnlineText') },
                  { v: 'on_site', titre: t('accountUi.pickupPayOnSiteOnly'), texte: t('accountUi.pickupPayOnSiteOnlyText') },
                  { v: 'both', titre: t('accountUi.pickupPayBoth'), texte: t('accountUi.pickupPayBothText') }
                ].map((o) => (
                  <label key={o.v} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '0 0 8px', cursor: 'pointer' }}>
                    <input type="radio" name="pickup-payment-mode" style={{ width: 'auto', marginTop: 3 }} checked={pickupPaymentMode === o.v} disabled={savingServices} onChange={() => setPickupPaymentMode(o.v)} />
                    <span><b>{o.titre}</b><br /><span className="small">{o.texte}</span></span>
                  </label>
                ))}
                {pickupPaymentMode !== 'online' && <p className="small" style={{ margin: '4px 0 0' }}>⚠️ {t('accountUi.pickupPayNoShowWarn')}</p>}
              </fieldset>
            )}
            {/* Récapitulatif vivant : le restaurateur voit la conséquence de sa combinaison avant
                d'enregistrer, plutôt que d'avoir à la déduire de trois cases. */}
            <p className="small service-summary">
              {!offersDelivery && !offersPickup && !offersDineIn
                ? t('accountUi.oneServiceWarn')
                : !offersDelivery && !offersPickup
                  ? t('accountUi.onlyReservationInfo')
                  : offersDelivery && offersPickup && offersDineIn
                    ? t('accountUi.allServicesInfo')
                    : t('accountUi.someServicesInfo', { list: [offersDelivery && t('accountUi.svcListDelivery'), offersPickup && t('accountUi.svcListPickup'), offersDineIn && t('accountUi.svcListReservation')].filter(Boolean).join(', ') })}
            </p>
            <button className="btn-teal" disabled={savingServices} onClick={saveServices}>{savingServices ? '...' : t('common.save')}</button>
          </LigneCompte>

          {/* Rubriques qu'on ouvre de temps en temps, sorties de la barre du bas. Ici elles gardent leur nom.
              Les réservations (agenda, plan de salle, règles, agenda externe) ont leur propre rubrique principale. */}
          <LigneCompte to="/dashboard/promotions" icone="etiquette" titre={t('accountUi.promotions')} />
          <LigneCompte to="/dashboard/guide" icone="guide" titre={t('accountUi.guide')} />
          <LigneCompte to="/dashboard/reviews" icone="etoile" titre={t('accountUi.customerReviews')} sous={restaurant.reviewCount > 0 ? t('accountUi.ratingSummary', { rating: restaurant.rating.toFixed(1), count: restaurant.reviewCount }) : t('accountUi.noReviewsYet')} />
        </div>
      )}

      {/* Rubriques du livreur qu'on ouvre de temps en temps, sorties de la barre du bas au profit de ce
          qu'il consulte en course : commandes, carte, pourboires. */}
      {role === 'driver' && (
        <div className="card account-groupe" aria-label={t('accountUi.myRides')}>
          <LigneCompte icone="stats" titre={t('account.driverActivityTitle')} sous={driverDeliveries ? t('accountUi.deliveriesDone', { n: driverDeliveries.filter((o) => o.status === 'livre').length }) : '…'} ouverte={ouvertes.has('activite')} onClick={() => basculer('activite')}>
            <DriverActivity deliveries={driverDeliveries} reviews={driverReviews} t={t} />
          </LigneCompte>
          <LigneCompte icone="contrat" titre={t('driverTerms.rowTitle')} sous={t('driverTerms.rowSub')} ouverte={ouvertes.has('contrat')} onClick={() => basculer('contrat')}>
            {ouvertes.has('contrat') && <DriverContractTerms />}
          </LigneCompte>
          <LigneCompte to="/driver/earnings" icone="euro" titre={t('accountUi.earningsRow')} sous={t('accountUi.earningsRowSub')} />
          <LigneCompte icone="euro" titre={t('accountUi.paymentRow')} sous={user.stripeConnectStatus === 'active' ? t('accountUi.driverPaymentRowSubActive') : t('accountUi.driverPaymentRowSub')} ouverte={ouvertes.has('paiement')} onClick={() => basculer('paiement')}>
            <PaiementLivreur user={user} deliveries={driverDeliveries} />
          </LigneCompte>
        </div>
      )}

      {/* Les casquettes du compte : commander, tenir un commerce, livrer. Placé juste avant
          l'assistance, donc après tout ce qui concerne le rôle en cours — on ne propose pas de
          changer de vue à quelqu'un qui n'a pas fini de lire la sienne. */}
      <MesCasquettes />

      {/* Assistance — commune à tous les rôles : un restaurateur ou un livreur a autant besoin de
          signaler un bug qu'un client. « Supprimer mon compte » n'y figure pas : il est au bout de
          « Mes infos », avec le reste de ce qui concerne la personne. */}
      <div className="card account-groupe" aria-label={t('accountUi.support')}>
        <LigneCompte to="/aide" icone="bouee" titre={t('accountUi.needHelp')} sous={t('accountUi.needHelpSub')} />
        <LigneCompte to="/aide?sujet=avis" icone="etoile" titre={t('accountUi.feedback')} sous={t('accountUi.feedbackSub')} />
        <LigneCompte icone="lien" titre={t('accountUi.share')} sous={t('accountUi.shareSub')} onClick={partagerFairide} />
        <LigneCompte to="/aide?sujet=bug" icone="bogue" titre={t('accountUi.reportBug')} sous={t('accountUi.reportBugSub')} />
        {role !== 'client' && <LigneCompte to="/notre-histoire" icone="boussole" titre={t('accountUi.ourStory')} />}
        {role !== 'client' && <LigneCompte to="/jeux" icone="manette" titre={t('accountUi.games')} />}
      </div>

      <button className="btn-danger-ghost" onClick={logout}>{t('nav.logout')}</button>

      <p className="account-legal">
        <Link to="/confidentialite">{t('accountUi.privacy')}</Link>
        <Link to="/cgv">CGV</Link>
        <Link to="/mentions-legales">{t('accountUi.legalNotice')}</Link>
        <span className="account-build">Build {__BUILD_ID__}</span>
      </p>
    </div>
  );
}

// Un champ (email OU téléphone) avec son propre flux demande-code / confirme-code, indépendant de
// saveInfo() ci-dessus : la nouvelle valeur n'est jamais envoyée telle quelle à confirmContactChange
// tant qu'un code valide n'est pas fourni, donc rien à gérer côté état global du formulaire principal.
function ContactChangeField({ field, label, currentValue, type, placeholder, requestContactChange, confirmContactChange, toast }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function cancel() {
    setEditing(false);
    setCodeSent(false);
    setNewValue('');
    setCode('');
  }

  async function sendCode() {
    if (!newValue.trim()) { toast(t('accountUi.toastNewValue')); return; }
    setSending(true);
    try {
      await requestContactChange(field, newValue.trim());
      setCodeSent(true);
      toast(t('accountUi.toastCodeSent'));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    if (!code.trim()) { toast(t('accountUi.toastCodeRequired')); return; }
    setConfirming(true);
    try {
      await confirmContactChange(field, newValue.trim(), code.trim());
      toast(t('accountUi.toastFieldUpdated', { label }));
      cancel();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setConfirming(false);
    }
  }

  if (!editing) {
    return (
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        <div>
          <div className="small" style={{ opacity: 0.7 }}>{label}</div>
          <div>{currentValue || '-'}</div>
        </div>
        <button type="button" className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setEditing(true)}>{t('accountUi.change')}</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div className="small" style={{ opacity: 0.7, marginBottom: 4 }}>{label}</div>
      {!codeSent ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, margin: 0, minWidth: 180 }}>
            {type === 'tel' ? <PhoneInput value={newValue} onChange={setNewValue} /> : <input type={type} value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={placeholder} />}
          </div>
          <button type="button" className="btn-teal" disabled={sending} onClick={sendCode}>{sending ? '...' : t('accountUi.sendCode')}</button>
          <button type="button" className="btn-ghost" onClick={cancel}>{t('accountUi.cancel')}</button>
        </div>
      ) : (
        <div>
          <p className="small" style={{ margin: '0 0 8px' }}>
            {t('accountUi.codeSentConfirmSwitch', { sms: field === 'phone' ? t('accountUi.noSmsYet') : '' })} <b>{newValue}</b>.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, margin: 0, minWidth: 140 }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
            </div>
            <button type="button" className="btn-teal" disabled={confirming} onClick={confirm}>{confirming ? '...' : 'Confirmer'}</button>
            <button type="button" className="btn-ghost" disabled={sending} onClick={sendCode}>{t('accountUi.resend')}</button>
            <button type="button" className="btn-ghost" onClick={cancel}>{t('accountUi.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Résumé compact de l'activité du livreur, dans sa rangée dépliable de la page Mon compte — les détails
// (avis, historique de livraisons, pourboires) vivent chacun sur leur propre page dédiée.
function DriverActivity({ deliveries, reviews, t }) {
  if (!deliveries) return <p className="small">{t('accountUi.loading')}</p>;

  const delivered = deliveries.filter((o) => o.status === 'livre');
  const totalDeliveryFees = delivered.reduce((a, o) => a + o.deliveryFee, 0);
  const totalTips = delivered.filter((o) => o.tipPaid && o.tipAmount > 0).reduce((a, o) => a + o.tipAmount, 0);

  return (
    <div className="stat-grid" style={{ marginTop: 0 }}>
      <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">{t('account.deliveriesDone')}</div></div>
      <div className="stat-card highlight"><div className="num">{(totalDeliveryFees + totalTips).toFixed(2)}€</div><div className="label">{t('account.estimatedEarnings')}</div></div>
      <div className="stat-card">
        <div className="num" style={{ fontSize: 18 }}><StarsDisplay value={reviews?.avg || 0} size={18} /></div>
        <div className="label">{reviews?.count > 0 ? t('restaurantMenu.ratingReviews', { rating: reviews.avg.toFixed(1), count: reviews.count }) : t('account.noReviewsYet')}</div>
      </div>
    </div>
  );
}
