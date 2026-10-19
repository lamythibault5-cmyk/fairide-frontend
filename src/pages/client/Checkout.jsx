import { allerAuPaiement, experienceApp } from '../../natif';

/* DANS L'APPLICATION (2026-10-15), rien d'obligatoire n'attend en bas de la page : les codes (promo, bon cadeau) et la
 * demande d'allergie sont des rangées qui ouvrent une feuille, comme l'adresse et la remise ; l'âge et les CGU, quand il
 * faut les cocher, viennent dans une feuille « Avant de commander » ouverte par le bouton de paiement, qui porte le
 * « Commander et payer » final (CDE VI.46 §2). Le site garde la page telle quelle. */
const APPLI = experienceApp();
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { euros, libellePromo } from '../../prixPlat';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards, SqueletteEcran } from '../../components/Skeleton';
import ErreurChargement from '../../components/ErreurChargement';
import { ligneIndisponible, lignesIndisponibles } from '../../panierDisponible';
import { DELIVERY_INSTRUCTION_OPTIONS, deliveryInstructionLabel } from '../../orderStatus';
import Icone from '../../components/Icone';
import ChoixPastilles from '../../components/ChoixPastilles';
import ChiffresRoulants from '../../components/ChiffresRoulants';
import { BandeauCommande, BarreCommande, FeuilleCommande, OptionCommande, RouteCommande, RouteEtapes } from '../../components/EcranCommande';
import SousEcran from '../../components/SousEcran';
import AddressSearch from '../../components/AddressSearch';
import ChoixAdresse from '../../components/ChoixAdresse';
import { getScheduleDateOptions, getScheduleTimeOptions } from '../../scheduleUtils';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { serviceOuvert, dateOuvertureEmporter, paiementEnLigneOuvert, useLancement, livraisonDisponible, exempteLancement } from '../../launch';
import CodePromoCheckout from '../../components/client/CodePromoCheckout';
import CheckoutConformite from '../../components/conformite/CheckoutConformite';
import { manqueConformite } from '../../conformite';
import { defilement, vibrer } from '../../gestes';

// Juste avant de valider la commande : si le panier ne contient encore aucun dessert/aucune boisson,
// propose quelques options de cette section pour ne pas les laisser passer — même logique qu'un
// service à table qui demande "un dessert avec ça ?", pas une case à cocher qu'on pourrait manquer.
// Les suggestions de fin de panier (« un dessert avec ça ? ») ont demenage dans la page Panier,
// ou elles sont proposees AVANT d'entrer dans le paiement : voir components/UpsellPanier.jsx.
// Le paiement ne montre plus que ce qu'on paie.

// Page dédiée affichée après le clic sur "Commander" depuis le panier : le client y choisit
// livraison/à emporter, vérifie ses informations, puis valide avant de passer au paiement.
export default function Checkout() {
  const { token, user, refreshUser } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const libellesDates = { today: t('checkout.dateToday'), tomorrow: t('checkout.dateTomorrow') };
  // Fairide = livraison et à emporter (fondateur, 2026-09-25) : plus de réservation de table.

  const [restaurant, setRestaurant] = useState(null);
  const [notFound, setNotFound] = useState(false);
  // Commerce pas lu (réseau, serveur) : Réessayer — « Ce restaurant n'est plus disponible » n'est dit que pour un vrai 404.
  const [echecChargement, setEchecChargement] = useState(false);
  const [essai, setEssai] = useState(0);
  const [addressStreet, setAddressStreet] = useState(user.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(user.addressNumber || '');
  const [addressPostalCode, setAddressPostalCode] = useState(user.addressPostalCode || '');
  const [addressCity, setAddressCity] = useState(user.addressCity || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState('sonner');
  // De l'alcool ne se dépose pas devant une porte : le livreur contrôle l'âge en main propre (plan de test LEG-9 /
  // PAN-8, le serveur refuse aussi : DEPOT_ALCOOL_INTERDIT). L'option disparaît, et un choix déjà fait repasse à « Sonner ».
  const panierAlcool = Object.values(cart.lines).some((l) => restaurant?.menu?.find((m) => m.id === l.itemId)?.isAlcohol);
  useEffect(() => { if (panierAlcool && deliveryInstructions === 'deposer') setDeliveryInstructions('sonner'); }, [panierAlcool, deliveryInstructions]);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [useBalance, setUseBalance] = useState(true);
  // À emporter chez un commerce qui l'accepte : payer au retrait plutôt qu'en ligne.
  const [paiementSurPlace, setPaiementSurPlace] = useState(false);
  // Bon cadeau du commerce (vendu au comptoir, voir Promotions → Bons cadeaux côté restaurateur) :
  // vérifié à la saisie, déduit côté serveur à la création de la commande.
  const [giftCode, setGiftCode] = useState('');
  const [giftCheck, setGiftCheck] = useState(null);
  // Code promo de commande appliqué (MON-6, CodePromoCheckout) : { code, discount, label } ou null.
  const [codePromo, setCodePromo] = useState(null);
  // Pourboire choisi au paiement (backend pourboireCommande.js) : '0', '1', '2', '3' ou 'autre' (montant libre). Aucun
  // par défaut : un pourboire présélectionné serait payé par des clients qui ne l'ont pas choisi.
  const [pourboire, setPourboire] = useState('0');
  const [pourboireAutre, setPourboireAutre] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState('delivery');
  // Sous-ecran ouvert par-dessus le paiement : 'adresse', 'remise', ou null.
  const [sousEcran, setSousEcran] = useState(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  // Les jours et créneaux suivent les horaires du commerce (scheduleUtils.js) : recalculés une fois la fiche chargée.
  const ouverture = restaurant ? { hours: restaurant.hours, closures: restaurant.closures } : null;
  const dateOptions = useMemo(() => getScheduleDateOptions(7, libellesDates, ouverture), [restaurant]); // eslint-disable-line react-hooks/exhaustive-deps
  const [placing, setPlacing] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Total affiché au moment du clic, pour dire au client de combien il a bougé quand la carte de confirmation s'affiche.
  const [totalAnnonce, setTotalAnnonce] = useState(null);
  // Dernier devis du serveur : { cle (le corps de commande qui l'a produit), order } — voir l'effet « DEVIS » plus bas.
  const [devis, setDevis] = useState(null);
  // Allergie, âge, CGU (backlog de conformité C1, C3, A1) — voir components/conformite/CheckoutConformite.jsx.
  const [conformite, setConformite] = useState({ allergyRequest: '', ageDeclaration: false, acceptTerms: false, termsNeeded: false, termsVersion: '' });
  const pendingOrderRef = useRef(null);
  const fulfillmentInitRef = useRef(false);
  // Commande envoyée : vider le panier ne doit plus renvoyer vers la liste des commerces (effet ci-dessous), sinon le
  // client payé sur place ou en paiement simulé atterrissait sur /restaurants au lieu du suivi de sa commande.
  const commandeTermineeRef = useRef(false);

  const restaurantId = cart.restaurantId;

  useEffect(() => {
    if (commandeTermineeRef.current) return;
    if (!restaurantId || cart.count === 0) {
      // Retour arrière depuis la page de paiement : le panier est mis de côté (stashForPayment), pas perdu. « Ton panier
      // est vide » était faux ; Mes commandes montre la commande au paiement non terminé, avec « Payer » et « Revenir au
      // panier » (audit du 15/10/2026).
      if (cart.hasStashed()) { navigate('/orders', { replace: true }); return; }
      // Arrivé ici sans panier (lien direct, onglet rouvert) : on le dit, au lieu de changer de page sans un mot (PAN-6).
      toast(t('checkout.toastEmptyCart'));
      navigate('/restaurants');
      return;
    }
    // Avec la session : un commerce que le public ne voit pas encore (le sien, celui de la simulation) reste commandable.
    api(`/restaurants/${restaurantId}`, { token }).then(setRestaurant).catch((e) => (e.status === 404 ? setNotFound(true) : setEchecChargement(true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, essai]);

  // Corrige le type de commande par défaut (initialisé à 'delivery' avant même de savoir ce que ce
  // restaurant propose) une fois ses services chargés — une seule fois, pour ne pas écraser un choix
  // déjà fait par le client si le restaurant est rechargé ensuite.
  useEffect(() => {
    if (!restaurant || fulfillmentInitRef.current) return;
    fulfillmentInitRef.current = true;
    // Commerce sans livraison ni à emporter (commande en ligne fermée) : retour à sa fiche, le panier est conservé.
    if (!restaurant.offersDelivery && !restaurant.offersPickup) {
      toast(t('checkout.toastNoOnlineOrder'), 'erreur');
      navigate(`/restaurants/${restaurantId}`);
      return;
    }
    // Livraison pas encore ouverte (avant le GO) : l'à emporter est proposé d'abord.
    if (!restaurant.offersDelivery || (!serviceOuvert('delivery', user) && restaurant.offersPickup)) { setFulfillmentType('pickup'); return; }
    // Sinon, le mode choisi sur la fiche du commerce (RestaurantMenu, sessionStorage) est repris.
    let choisi = null;
    try { choisi = sessionStorage.getItem(`fairide_mode_${restaurantId}`); } catch { /* navigation privée */ }
    if (choisi === 'pickup' && restaurant.offersPickup) setFulfillmentType('pickup');
  }, [restaurant]); // eslint-disable-line react-hooks/exhaustive-deps -- une seule fois, au chargement du commerce (fulfillmentInitRef)

  useEffect(() => {
    if (pendingOrder && pendingOrderRef.current) {
      pendingOrderRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [pendingOrder]);

  /* DEVIS : LE TOTAL EXACT AVANT LE CLIC (2026-10-13, backend POST /orders/devis).
   * Le serveur rejoue le calcul complet de la commande (distance réelle, minimum du livreur, bon cadeau, code promo,
   * solde) sans rien enregistrer. Le bouton annonce alors le vrai total, et « Commander et payer » part directement au
   * paiement — y compris avec un bon cadeau, qui faisait jusqu'ici réapparaître la carte de confirmation.
   * Redemandé 450 ms après le dernier changement (adresse tapée, quantité, code) ; une réponse qui ne correspond plus
   * au panier affiché est ignorée (voir devisValide). En cas d'erreur (CGU à accepter, âge à déclarer, serveur ancien
   * sans la route), on garde l'estimation : le devis n'est jamais une condition pour commander.
   * L'effet est placé avant les retours anticipés (règle des hooks) ; il ne lit les valeurs calculées plus bas qu'une
   * fois le commerce chargé, donc après un rendu complet. */
  useEffect(() => {
    if (!restaurant || pendingOrder || placing || paying) return undefined;
    const corps = corpsCommande();
    if (!corps) return undefined;
    const cle = JSON.stringify(corps);
    if (devis?.cle === cle) return undefined;
    let actif = true;
    const id = setTimeout(() => {
      api('/orders/devis', { method: 'POST', token, body: corps })
        .then((o) => { if (actif) setDevis({ cle, order: o }); })
        // Le refus est gardé (et non plus effacé) : s'il vient du commerce ou de l'adresse, il s'affiche sous le bouton
        // AVANT le clic, au lieu d'un toast qui disparaît après (audit du 15/10/2026, voir refusDevis plus bas).
        .catch((e) => { if (actif) setDevis({ cle, erreur: { message: e.message, code: e.code, status: e.status } }); });
    }, 450);
    return () => { actif = false; clearTimeout(id); };
  });

  // BOUTON GO (lancement.js côté serveur) : useLancement redessine la page au GO ou à la fermeture. Après GO, une livraison
  // demande un livreur libre à l'instant : relu toutes les minutes (null tant qu'on ne sait pas). Sans livreur, l'à emporter
  // est choisi pour le client s'il est proposé, et la livraison ne peut pas être commandée (le serveur la refuserait).
  useLancement();
  const [livraisonDispo, setLivraisonDispo] = useState(null);
  const verifierLivraison = !!restaurant?.offersDelivery && serviceOuvert('delivery', user) && !exempteLancement(user);
  useEffect(() => {
    if (!verifierLivraison) { setLivraisonDispo(null); return undefined; }
    let fini = false;
    const lire = () => livraisonDisponible(restaurantId).then((d) => { if (!fini && d) setLivraisonDispo(d.available); });
    lire();
    const id = setInterval(() => { if (document.visibilityState === 'visible') lire(); }, 60000);
    return () => { fini = true; clearInterval(id); };
  }, [verifierLivraison, restaurantId]);
  useEffect(() => {
    if (livraisonDispo === false && fulfillmentType === 'delivery' && restaurant?.offersPickup) selectFulfillment('pickup');
  }, [livraisonDispo]); // eslint-disable-line react-hooks/exhaustive-deps -- seulement quand la disponibilité change

  // L'etape « dessert/boisson » a quitte le paiement : elle est maintenant sur la page Panier, avant
  // d'y entrer. On arrive donc directement sur la confirmation des informations de commande.

  if (notFound) return <div className="empty">{t('checkout.notAvailable')}</div>;
  if (echecChargement && !restaurant) return <ErreurChargement onReessayer={() => { setEchecChargement(false); setEssai((n) => n + 1); }} />;
  // Chargement dans l'app : le bandeau et la feuille dès la première image (Skeleton.jsx, audit « Look and feel »).
  if (!restaurant) return experienceApp() ? <SqueletteEcran titre={t('checkout.headerTitle')} lignes={3} /> : <SkeletonCards count={2} />;

  // Ce qui manque pour atteindre le minimum du commerce (PAN-3), sur la valeur des plats avant remises, comme le serveur.
  const manqueMinimum = restaurant.minOrderAmount ? Math.max(0, +(restaurant.minOrderAmount - cart.rawTotal).toFixed(2)) : 0;
  const totals = cart.totals(restaurant.menu, restaurant.activeCartPromo, { freeDelivery: restaurant.freeDelivery, deliveryFeeDiscount: restaurant.deliveryFeeDiscount, freeDeliveryMinOrder: restaurant.freeDeliveryMinOrder, deliveryMode: restaurant.deliveryMode, ownDeliveryFee: restaurant.ownDeliveryFee });
  // Mode choisi par le commerce : en ligne seulement, sur place seulement, ou au choix du client.
  const modeEmporter = restaurant.pickupPaymentMode || (restaurant.pickupPayOnSite ? 'both' : 'online');
  // Payée sur place : ce que le commerce accepte au comptoir, et ce qui arrive si l'on ne vient pas (fondateur, 18/10/2026).
  const LIBELLES_PAIEMENT = { especes: 'payEspeces', bancontact: 'payBancontact', carte: 'payCarte', payconiq: 'payPayconiq', titres_repas: 'payTitresRepas' };
  const moyensSurPlace = (restaurant.paiementsSurPlace || []).map((p) => t(`restaurantMenu.${LIBELLES_PAIEMENT[p] || 'payCarte'}`)).join(', ');
  const notesSurPlace = (
    <>
      {moyensSurPlace && <p className="small" style={{ margin: '4px 0 0' }}>{t('retrait.accepted', { list: moyensSurPlace })}</p>}
      <p className="small checkout-regle-retrait"><Icone nom="alerte" taille={14} className="icone-texte" />{' '}{t('retrait.noShowRule')}</p>
    </>
  );
  // Avant le GO, l'à emporter ne se paie que sur place : si le commerce laisse le choix, « sur place » est
  // imposé ; s'il n'accepte que le paiement en ligne, la commande attend l'ouverture.
  const enLigneFerme = fulfillmentType === 'pickup' && !paiementEnLigneOuvert(user);
  // Livraison choisie alors qu'aucun livreur n'est libre (commerce sans à emporter) : pas de bouton de paiement.
  const sansLivreur = fulfillmentType === 'delivery' && livraisonDispo === false;
  const surPlaceChoisi = fulfillmentType === 'pickup' && (modeEmporter === 'on_site' || (modeEmporter === 'both' && (paiementSurPlace || enLigneFerme)));
  // Frais de système (10 % de la livraison, compris dedans, voir src/fraisService.js) : en livraison seulement. La part de Fairide
  // sur les plats est déjà dans les prix affichés.
  const fraisServiceEstimes = fulfillmentType === 'delivery' ? totals.serviceFee : 0;
  const estimatedTotalBeforeBalance = fulfillmentType === 'delivery' ? totals.total : totals.subtotal;
  const paiementBloque = enLigneFerme && modeEmporter === 'online';
  const soldeUtilise = useBalance && !surPlaceChoisi;
  const apresCodePromo = Math.max(0, +(estimatedTotalBeforeBalance - (codePromo?.discount || 0)).toFixed(2));
  const estimatedTotal = Math.max(0, apresCodePromo - (soldeUtilise ? Math.min(user.balance || 0, apresCodePromo) : 0));
  const scheduleTimeOptions = scheduleDate ? getScheduleTimeOptions(scheduleDate, ouverture) : [];
  const scheduledPreview = scheduleDate && scheduleTime
    ? new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null;
  function selectFulfillment(type) {
    setFulfillmentType(type);
    setScheduleEnabled(false);
    setScheduleDate('');
    setScheduleTime('');
  }

  /* LE PAIEMENT EST UNE PAGE DE RANGÉES, PAS UN ASSISTANT.
   *
   * Première version : un assistant en étapes. Les captures d'Uber Eats fournies par le fondateur
   * montrent autre chose, et c'est mieux — UNE page qui résume l'état complet de la commande en
   * rangées (« Livrer à … », « Sonner et attendre »), chacune ouvrant un écran pour la corriger.
   *
   * La différence n'est pas cosmétique. Un assistant impose de traverser chaque question dans
   * l'ordre, même celles dont le défaut convenait ; ici on voit tout d'emblée et on n'ouvre que ce
   * qu'on veut changer. Sur un paiement où presque tout est déjà connu — l'adresse vient du compte,
   * la remise a un défaut — c'est la bonne forme.
   *
   * RIEN DE LA LOGIQUE N'A BOUGÉ lors de ce passage en rangées : ni placeOrder, ni confirmAndPay, ni la
   * validation. C'est le chemin de l'argent ; refaire la présentation ne doit pas être l'occasion d'en
   * réécrire le fond. (Le 2026-10-13, un changement de logique distinct et assumé : placeOrder enchaîne sur
   * le paiement quand le total n'a pas bougé — voir le commentaire dans placeOrder.)
   *
   * `sousEcran` vaut 'adresse', 'remise' ou null. Voir components/SousEcran.jsx. */
  const adresseIncomplete = !addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim();
  const adresseResume = adresseIncomplete
    ? ''
    : `${addressStreet.trim()} ${addressNumber.trim()}, ${addressPostalCode.trim()} ${addressCity.trim()}`;

  // Le corps d'une commande, partagé par le devis et la vraie commande : un devis calculé sur autre chose que ce qui
  // sera envoyé ne servirait à rien. null tant qu'il manque de quoi calculer (adresse, heure programmée, minimum).
  function corpsCommande() {
    if (!cart.count || manqueMinimum > 0 || paiementBloque || !serviceOuvert(fulfillmentType, user)) return null;
    if (fulfillmentType === 'delivery' && (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim())) return null;
    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) return null;
    const surPlace = surPlaceChoisi;
    return {
      restaurantId, items: Object.values(cart.lines).map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds, note: l.note || undefined })),
      orderType: fulfillmentType,
      paymentChoice: surPlace ? 'on_site' : undefined,
      // Commande programmée : heure locale.
      scheduledFor: scheduleEnabled ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString() : null,
      ...(fulfillmentType === 'delivery' ? {
        addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
        addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
        deliveryInstructions, deliveryNote: deliveryNote.trim()
      } : {}),
      useBalance: useBalance && !surPlace,
      giftVoucherCode: giftCheck?.valid ? giftCode.trim() : undefined,
      promoCode: codePromo?.code || undefined,
      allergyRequest: conformite.allergyRequest.trim() || undefined, ageDeclaration: conformite.ageDeclaration || undefined,
      ...(conformite.termsNeeded ? { acceptTerms: conformite.acceptTerms, termsVersion: conformite.termsVersion } : {})
    };
  }
  // Le devis ne vaut que s'il a été calculé sur le panier affiché ; sinon on retombe sur l'estimation du navigateur.
  const corpsActuel = corpsCommande();
  const devisValide = corpsActuel && devis && devis.cle === JSON.stringify(corpsActuel) ? devis.order : null;
  const montantAnnonce = devisValide ? Number(devisValide.total) : estimatedTotal;
  /* LE POURBOIRE S'AJOUTE À CE QUI EST DÉBITÉ, PAS AU TOTAL DE LA COMMANDE. Le serveur ne le met pas dans orders.total
   * (commission, remboursements, reçu restent ceux de la commande) : il l'ajoute comme une ligne de plus sur la page
   * Stripe. montantAnnonce reste donc le total de la commande — c'est lui que placeOrder compare au total du serveur —,
   * et l'écran affiche montantAnnonce + pourboire. Seulement en livraison payée en ligne, et pas sur une commande que
   * le solde couvre en entier : elle n'ouvre aucune page de paiement. */
  const offrePourboire = fulfillmentType === 'delivery' && !surPlaceChoisi && montantAnnonce > 0;
  const pourboireChoisi = !offrePourboire ? 0
    : pourboire === 'autre' ? Math.max(0, +(Number(String(pourboireAutre).replace(',', '.')) || 0).toFixed(2))
    : Number(pourboire);
  const montantDebite = +(montantAnnonce + pourboireChoisi).toFixed(2);
  // Refus du serveur sur le panier affiché : commerce fermé ou en pause, adresse introuvable ou trop loin, commerce pas
  // encore actif… Sauf ce que le client règle sur cette page même (CGU, âge, téléphone, dépôt devant la porte avec de
  // l'alcool) : ces cases sont sous ses yeux, les annoncer avant qu'il ait pu les cocher serait du bruit. Ni les erreurs
  // réseau, serveur ou de cadence (429) : celles-là ne disent rien de la commande.
  const REFUS_REGLES_ICI = ['CGU_A_ACCEPTER', 'AGE_DECLARATION_REQUISE', 'PHONE_REQUIRED', 'DEPOT_ALCOOL_INTERDIT'];
  const erreurDevis = corpsActuel && devis?.erreur && devis.cle === JSON.stringify(corpsActuel) ? devis.erreur : null;
  const refusDevis = erreurDevis && erreurDevis.status >= 400 && erreurDevis.status < 500 && erreurDevis.status !== 429
    && !REFUS_REGLES_ICI.includes(erreurDevis.code) ? erreurDevis.message : null;

  // Commande payée sur place, partie au commerce : l'écran de confirmation (OrderResult.jsx) avec tout le retrait — numéro,
  // code, heure, adresse, itinéraire, appel, moyens de paiement. Avant : un message de trois secondes, puis Mes commandes.
  function terminerSurPlace(order) {
    commandeTermineeRef.current = true;
    cart.clear();
    vibrer('succes');
    navigate(`/order-success?order=${order.id}`, { replace: true });
  }

  async function placeOrder() {
    if (fulfillmentType === 'delivery' && (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim())) {
      toast(t('checkout.toastAddressRequired'), 'erreur');
      return;
    }
    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) {
      toast(t('checkout.toastScheduledDateTimeRequired'), 'erreur');
      return;
    }
    // Stripe n'encaisse rien sous 0,50 € : refusé ici plutôt qu'après la création de la commande.
    if (pourboireChoisi > 0 && pourboireChoisi < 0.5) {
      toast(t('checkout.tipTooSmall'), 'erreur');
      return;
    }
    const manque = manqueConformite(conformite, restaurant, Object.values(cart.lines), fulfillmentType, t);
    if (manque && APPLI) { setSousEcran('avantCommande'); return; }
    if (manque) {
      toast(manque);
      // Sur téléphone, la case à cocher est tout en bas, loin du bouton : on y amène le client au lieu de le laisser chercher.
      const caseManquante = [...document.querySelectorAll('.checkout-conformite .co-case input')].find((i) => !i.checked);
      if (caseManquante) { caseManquante.closest('.co-case').scrollIntoView({ behavior: defilement(), block: 'center' }); caseManquante.focus({ preventScroll: true }); }
      return;
    }
    if (lignesIndisponibles(cart.lines, restaurant?.menu).length) { toast(t('checkout.removeUnavailable'), 'erreur'); return; }
    setPlacing(true);
    try {
      // Les frais de livraison dépendent de la distance réelle et ne sont connus qu'une fois la commande
      // créée côté serveur — on affiche donc le total exact avant de rediriger vers le paiement.
      const surPlace = surPlaceChoisi;
      const order = await api('/orders', {
        method: 'POST', token,
        // Même panier = même commande, même depuis un onglet dupliqué (plan de test CMD-19, voir CartContext).
        // Payée sur place : le total vu part avec la commande ; s'il tombe juste, le serveur l'envoie au commerce dans le même
        // appel (plus de commande « fantôme » quand un second appel échouait). Sinon, la carte « le total a changé », comme avant.
        body: { ...corpsCommande(), clientRequestId: cart.requestId, ...(surPlace ? { confirmOnSite: true, expectedTotal: montantAnnonce } : {}) }
      });
      if (order.paymentMode === 'on_site' && order.paid) { terminerSurPlace(order); return; }
      if (order.balanceUsed > 0) refreshUser().catch(() => {});
      /* UN SEUL BOUTON QUAND RIEN N'A BOUGÉ (2026-10-13).
       * Avant : « Valider mes informations », puis une carte « Confirme ta commande » avec une case à cocher, puis
       * « Commander et payer » — deux appuis et une case pour une commande dont le client venait de tout voir.
       * La carte existait pour une vraie raison (voir plus haut : les frais de livraison exacts ne sont connus
       * qu'ici), mais dans la plupart des cas le serveur confirme au centime le total affiché.
       *
       * Donc : même total et même mode de paiement que ce que le bouton annonçait → on part directement au
       * paiement. Sinon → la carte, qui dit ce qui a changé. Le bouton de la barre porte désormais « Commander et
       * payer » (CDE VI.46 §2) et le récapitulatif nomme le vendeur de chaque ligne, comme la carte le faisait.
       *
       * La case « Je confirme que mes informations de livraison sont correctes » est partie : aucune loi ne
       * l'exige, le serveur ne la vérifiait pas, et l'adresse et la remise sont déjà visibles en rangées juste
       * au-dessus du bouton (CDE XII.7 : corriger ses erreurs de saisie avant de commander). */
      const memeMode = (order.paymentMode === 'on_site') === surPlace;
      // Comparé au montant que le bouton annonçait : le devis du serveur quand il est là (il tombe juste), sinon l'estimation.
      if (memeMode && Math.abs(Number(order.total) - montantAnnonce) < 0.005) {
        await confirmAndPay(order);
        return;
      }
      setTotalAnnonce(montantAnnonce);
      setPendingOrder(order);
    } catch (e) {
      // CGU passées à une nouvelle version entre l'ouverture de la page et le clic : on affiche la case.
      if (e.code === 'CGU_A_ACCEPTER') setConformite((c) => ({ ...c, termsNeeded: true, acceptTerms: false, termsVersion: e.data?.termsVersion || c.termsVersion }));
      // Ce panier a déjà donné une commande (payée dans un autre onglet) : on ne la repasse pas, on la montre.
      if (e.code === 'ORDER_ALREADY_PLACED') { commandeTermineeRef.current = true; cart.clear(); toast(e.message); navigate('/orders'); return; }
      // Pas de téléphone sur le compte : on y envoie le client, le panier l'attend.
      if (e.code === 'PHONE_REQUIRED') { toast(e.message, 'erreur'); navigate('/account?ouvrir=connexion&retour=/checkout'); return; }
      toast(e.message, 'erreur');
    } finally {
      setPlacing(false);
    }
  }

  // `order` : la commande à payer — passée directement par placeOrder quand le total n'a pas bougé (pas de carte de
  // confirmation), sinon celle de la carte.
  async function confirmAndPay(order = pendingOrder) {
    setPaying(true);
    try {
      // Paiement sur place : rien à encaisser en ligne, la commande part au commerce.
      if (order.paymentMode === 'on_site') {
        terminerSurPlace(await api(`/orders/${order.id}/confirm-on-site`, { method: 'POST', token }));
        return;
      }
      // Le pourboire choisi part avec la demande de paiement (0 = aucun) ; sans objet hors livraison ou à total nul.
      const tip = order.orderType === 'delivery' && Number(order.total) > 0 ? pourboireChoisi : 0;
      const pay = await api(`/payments/checkout/${order.id}`, { method: 'POST', token, body: { tip } });
      if (pay.simulated) {
        // Chemin simulé : le paiement est acquis immédiatement, donc vider le panier ici est correct.
        commandeTermineeRef.current = true;
        cart.clear();
        vibrer('succes');
        toast(t('checkout.toastOrderPaid'), 'succes');
        navigate('/orders');
      } else {
        // Le panier est mis de côté, pas vidé et pas laissé en place — voir stashForPayment() dans
        // CartContext.jsx pour le raisonnement complet. En résumé : le vider ici faisait perdre son
        // panier à tout client qui abandonnait ou dont la carte était refusée (le bug d'origine) ;
        // le laisser en place lui laissait un panier d'articles déjà payés s'il ne revenait jamais
        // sur la page de retour. La copie mise de côté est restaurée ou supprimée par OrderResult.jsx,
        // une fois l'issue réellement connue.
        cart.stashForPayment(order.id);
        await allerAuPaiement(pay.checkoutUrl, { retour: '/orders' });
      }
    } catch (e) {
      toast(e.message, 'erreur');
      setPaying(false);
      // Échec sur le chemin direct : la commande existe déjà côté serveur, non payée. On montre la carte, qui permet
      // de réessayer ou d'annuler (un nouveau clic sur la barre renverrait d'ailleurs cette même commande, voir
      // commandeExistante dans le backend).
      setPendingOrder(order);
    }
  }

  async function cancelOrder() {
    setCancelling(true);
    try {
      await api(`/orders/${pendingOrder.id}/cancel`, { method: 'PATCH', token });
      toast(t('checkout.toastOrderCancelled'), 'succes');
      // Le panier reste : il doit pouvoir repartir en une nouvelle commande (CartContext.nouvelleDemande).
      cart.nouvelleDemande();
      setPendingOrder(null);
      if (pendingOrder.balanceUsed > 0) refreshUser().catch(() => {});
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setCancelling(false);
    }
  }

  // Le pourboire : en tête du récapitulatif dans l'app, dans la colonne des choix sur le site (voir plus bas).
  const blocPourboire = offrePourboire && (
    <div className="field ec-pourboire">
      <span className="field-intitule ec-section">{t('checkout.tipTitle')}</span>
      <ChoixPastilles
        libelle={t('checkout.tipTitle')}
        valeur={pourboire}
        onChange={setPourboire}
        options={[
          { value: '0', label: t('review.tipNone') },
          { value: '1', label: euros(1) },
          { value: '2', label: euros(2) },
          { value: '3', label: euros(3) },
          { value: 'autre', label: t('checkout.tipOther') }
        ]}
      />
      {pourboire === 'autre' && (
        <input aria-label={t('checkout.tipOtherPh')} type="number" inputMode="decimal" min="0.5" step="0.5" placeholder={t('checkout.tipOtherPh')}
          value={pourboireAutre} onChange={(e) => setPourboireAutre(e.target.value)} style={{ marginTop: 6, maxWidth: 160 }} />
      )}
      <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink-soft)' }}>{t('checkout.tipSub')}</p>
    </div>
  );

  // Le bon cadeau : son champ et sa réponse, repliés sous le récapitulatif sur le site, dans la feuille « Codes » dans l'app.
  const champBonCadeau = (
    <>
      <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Un seul aria-label : il y en avait deux sur ce champ, et c'est le second qui
            l'emportait en silence — le champ s'annoncait donc « Bon cadeau », le nom de la
            section repliable juste au-dessus, au lieu de dire quoi y saisir. */}
        <input aria-label={t('checkout.giftVoucherPh')} value={giftCode} placeholder={t('checkout.giftVoucherPh')} maxLength={20} style={{ flex: '1 1 160px', textTransform: 'uppercase' }}
          onChange={(e) => { setGiftCode(e.target.value.toUpperCase()); setGiftCheck(null); }} />
        <button type="button" className="btn-outline" style={{ padding: '6px 12px' }} disabled={giftCode.trim().length < 6 || giftCheck === 'loading'}
          onClick={async () => {
            setGiftCheck('loading');
            try { setGiftCheck(await api(`/restaurants/${restaurantId}/gift-vouchers/check?code=${encodeURIComponent(giftCode.trim())}`, { token })); }
            catch (e) { setGiftCheck(null); toast(e.message, 'erreur'); }
          }}>{giftCheck === 'loading' ? '…' : t('checkout.giftVoucherCheck')}</button>
      </div>
      {giftCheck && giftCheck !== 'loading' && (
        <p className="small" style={{ margin: '6px 0 0', color: giftCheck.valid ? 'var(--teal-deep)' : 'var(--red)' }}>
          {giftCheck.valid ? t('checkout.giftVoucherOk', { amount: Number(giftCheck.remaining).toFixed(2) }) : t(`checkout.giftVoucherKo_${giftCheck.reason || 'introuvable'}`)}
        </p>
      )}
    </>
  );

  return (
    <div className="checkout-page ec-page sc-page">
      {/* Le retour mène au PANIER, et non plus directement à la carte du commerce : c'est l'écran
          d'où l'on vient, donc celui qu'on s'attend à retrouver en reculant. Revenir à la carte pour
          ajouter un plat reste possible — c'est « Ajouter un plat », dans la barre de récapitulatif
          plus bas, qui garde ce rôle.
          HABIT DU 2026-10-16 (« Proposition » de mockups/tous-les-ecrans.html) : bandeau iris où le vélo roule de
          « Panier » à « Paiement », les choix en cartes iris à coche lime, le reste dans la feuille blanche ; dans l'app, le
          total roule dans la pastille iris d'une barre de verre. Rien de la logique n'a bougé. */}
      <BandeauCommande
        vers="/panier" libelleRetour={t('panier.title')}
        haut={<><b>{restaurant.name}</b> · {t(cart.count > 1 ? 'ecranCommande.articlesPluriel' : 'ecranCommande.articles', { count: cart.count })}</>}
        titre={t('checkout.headerTitle')}
      >
        {/* Le site a la route à arrêts (RouteEtapes) ; l'app garde la sienne, sans arrêts. */}
        {APPLI ? (
          <RouteCommande position={50} depart={8} actuelle={1}
            etapes={[t('ecranCommande.etapePanier'), t('checkout.headerTitle'), t('ecranCommande.etapeSuivi')]} />
        ) : <RouteEtapes actuelle={1} />}
      </BandeauCommande>
      <FeuilleCommande>
      {/* Simulation (Admin › Simulation) : le paiement est fictif (backend payments.js, commerce de simulation) — on le
          dit clairement, pour que l'équipe puisse aller jusqu'au bout du parcours sans craindre un débit. */}
      {user?.simulation && <div className="card" style={{ borderLeft: '4px solid var(--lime)', background: '#14121F', color: '#fff', margin: '0 0 12px' }}><b>{t('checkout.simulationTitle')}</b><p className="small" style={{ margin: '4px 0 0', color: '#D7D4E8' }}>{t('checkout.simulationText')}</p></div>}


      {!pendingOrder && (
        <>
        <div className="checkout-grille">
          <div className="checkout-form">
          <div className="card">
            {(
            <div className="field">
              {/* Intitulé d'un GROUPE de boutons, pas d'un champ unique : un htmlFor n'aurait rien à
                  désigner. role="group" + aria-labelledby fait annoncer « Comment la recevoir » avant
                  les options, au lieu de trois boutons sans contexte. */}
              <span className="titre-groupe ec-section" id="checkout-fulfillment-label">{t('checkout.howToGet')}</span>
              {/* Des CARTES sélectionnables, pas une rangée de pilules — c'est le motif
                  « Priority / Standard / Schedule » de la capture 3 : une icône, un titre, et
                  l'option retenue en aplat iris avec sa coche lime (2026-10-16). Trois pilules côte à côte se lisaient
                  comme trois boutons d'égale importance, alors qu'il s'agit d'un choix unique. */}
              <div className="ec-options" role="group" aria-labelledby="checkout-fulfillment-label">
                {cart.count > 0 && (
                  <>
                    {/* Avant le GO, pas de carte « Livraison » qui mènerait à « bientôt » : l'à emporter seul (audit du 18/10/2026). */}
                    {restaurant.offersDelivery && (serviceOuvert('delivery', user) || !restaurant.offersPickup) && (
                      <OptionCommande on={fulfillmentType === 'delivery'} icone="scooter" titre={t('orderStatus.orderType.delivery')} onClick={() => selectFulfillment('delivery')} />
                    )}
                    {restaurant.offersPickup && (
                      <OptionCommande on={fulfillmentType === 'pickup'} icone="sac" titre={t('orderStatus.orderType.pickup')} onClick={() => selectFulfillment('pickup')} />
                    )}
                  </>
                )}
              </div>
            </div>
            )}
            {/* LES RANGÉES. Chacune résume une décision déjà prise et s'ouvre pour la corriger —
                c'est la forme des captures d'Uber, et elle convient parce qu'ici presque tout est
                déjà connu : l'adresse vient du compte, la remise a un défaut. */}
            {fulfillmentType === 'delivery' && (
              <button type="button" className="checkout-rangee" onClick={() => setSousEcran('adresse')}>
                <Icone nom="maison" taille={20} />
                <span className="checkout-rangee-texte">
                  <span className="checkout-rangee-titre">{adresseIncomplete ? t('checkout.addressMissing') : adresseResume}</span>
                  <span className={`checkout-rangee-sous${adresseIncomplete ? ' est-requis' : ''}`}>
                    {adresseIncomplete ? t('checkout.addressMissingSub') : t('checkout.addressEdit')}
                  </span>
                </span>
                <span className="checkout-rangee-chevron" aria-hidden="true">›</span>
              </button>
            )}
            {fulfillmentType === 'delivery' && (
              <button type="button" className="checkout-rangee" onClick={() => setSousEcran('remise')}>
                <Icone nom={DELIVERY_INSTRUCTION_OPTIONS.find((o) => o.value === deliveryInstructions)?.icon || 'sonnette'} taille={20} />
                <span className="checkout-rangee-texte">
                  <span className="checkout-rangee-titre">{deliveryInstructionLabel(deliveryInstructions, t)}</span>
                  <span className="checkout-rangee-sous">{deliveryNote.trim() || t('checkout.dropoffAdd')}</span>
                </span>
                <span className="checkout-rangee-chevron" aria-hidden="true">›</span>
              </button>
            )}
            {/* LES OPTIONS DE REMISE, ÉCRAN À PART. Elles existaient déjà — quatre choix, enregistrés
                et transmis au livreur — mais noyées au milieu du formulaire d'adresse, entre le code
                postal et l'horaire. Chez Uber c'est un écran qu'on ouvre depuis le paiement
                (« Dropoff options »), et c'est ce qu'elles méritent : c'est la seule consigne que le
                client donne à quelqu'un qui viendra chez lui. */}
            {fulfillmentType === 'pickup' && (
              <p className="small" style={{ margin: '0 0 10px' }}>{t('checkout.pickupSelf', { name: restaurant.name, address: restaurant.address ? `, ${restaurant.address}` : '' })}</p>
            )}
            {/* L'heure de retrait estimée par le serveur (temps de préparation du commerce, ou l'heure programmée), dès le devis. */}
            {fulfillmentType === 'pickup' && devisValide?.estimatedDeliveryAt && (
              <p className="small checkout-pret-vers"><Icone nom="horloge" taille={16} className="icone-texte" />{' '}{t('retrait.readyAt', { time: new Date(devisValide.estimatedDeliveryAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })}</p>
            )}
            {/* LE COMMERCE CHOISIT LE MODE DE PAIEMENT A EMPORTER (modeEmporter, pose par main) :
                en ligne seulement, sur place seulement, ou au choix du client. Quand il n'y a pas de
                choix a faire, on l'annonce au lieu d'afficher une bascule a une seule option — c'est
                une information, pas une question. */}
            {fulfillmentType === 'pickup' && modeEmporter === 'on_site' && (
              <div className="paiement-encart" style={{ marginBottom: 10 }}>
                <p className="small" style={{ margin: 0 }}><b><Icone nom="billet" taille={16} /> {t('checkout.payOnSiteOnly')}</b></p>
                <p className="small" style={{ margin: '4px 0 0' }}>{t('checkout.payOnSiteNote')}</p>
                {notesSurPlace}
              </div>
            )}
            {/* C'etaient deux boutons radio natifs, dont la cible utile etait la pastille de 13px
                dessinee par le navigateur. Ils deviennent des pastilles, comme le reste du
                formulaire. */}
            {fulfillmentType === 'pickup' && modeEmporter === 'both' && (
              <div className="field">
                <span className="field-intitule ec-section">{t('checkout.payWhen')}</span>
                <ChoixPastilles
                  libelle={t('checkout.payWhen')}
                  valeur={paiementSurPlace || enLigneFerme ? 'sur_place' : 'en_ligne'}
                  onChange={(v) => { if (!(enLigneFerme && v === 'en_ligne')) setPaiementSurPlace(v === 'sur_place'); }}
                  options={[
                    { value: 'en_ligne', label: enLigneFerme ? t('checkout.payOnlineFrom') : t('checkout.payOnline'), icone: <Icone nom="carteBancaire" taille={16} /> },
                    { value: 'sur_place', label: t('checkout.payOnSite'), icone: <Icone nom="billet" taille={16} /> }
                  ]}
                />
                {(paiementSurPlace || enLigneFerme) && <><p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.payOnSiteNote')}</p>{notesSurPlace}</>}
              </div>
            )}
            {/* QUAND LA RECEVOIR — deux cartes, comme le bloc « Delivery options » des captures.
                C'était une case à cocher isolée, qu'on ne lisait pas : maintenant les deux réponses
                possibles sont posées côte à côte et l'une est visiblement retenue.
                Il n'y a pas de troisième carte « Prioritaire » : Fairide n'a pas d'option de
                livraison payante plus rapide, et on n'invente pas une fonctionnalité pour faire
                joli. (Le temps de préparation du commerce existe depuis le 15/10/2026, backend migration 041,
                mais il ne sert qu'à l'heure estimée de la commande, pas à une livraison plus rapide.) */}
            {(
              <div className="field">
                <span className="titre-groupe ec-section" id="checkout-quand-label">{t(fulfillmentType === 'pickup' ? 'checkout.whenLabelPickup' : 'checkout.whenLabel')}</span>
                <div className="ec-options" role="group" aria-labelledby="checkout-quand-label">
                  <OptionCommande on={!scheduleEnabled} icone={fulfillmentType === 'pickup' ? 'sac' : 'scooter'} titre={t('checkout.whenAsap')}
                    onClick={() => { setScheduleEnabled(false); setScheduleDate(''); setScheduleTime(''); }} />
                  <OptionCommande on={scheduleEnabled} icone="horloge" titre={t('checkout.scheduleLater')}
                    onClick={() => { setScheduleEnabled(true); setScheduleDate(dateOptions[0]?.value || ''); setScheduleTime(''); }} />
                </div>
                {scheduleEnabled && (
                  <>
                    <div style={{ marginTop: 8 }}>
                      <ChoixPastilles
                        libelle={t('checkout.scheduleLater')}
                        valeur={scheduleDate}
                        onChange={(v) => { setScheduleDate(v); setScheduleTime(''); }}
                        options={dateOptions.map((d) => ({ value: d.value, label: d.label }))}
                      />
                      <ChoixPastilles
                        libelle={t('checkout.timePlaceholder')}
                        valeur={scheduleTime}
                        onChange={setScheduleTime}
                        options={scheduleTimeOptions.map((tm) => ({ value: tm, label: tm }))}
                      />
                    </div>
                    {scheduleTimeOptions.length === 0 && (
                      <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{t('checkout.noSlotsToday')}</p>
                    )}
                    {scheduledPreview && (
                      <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.scheduledPreview', { preview: scheduledPreview })}</p>
                    )}
                  </>
                )}
              </div>
            )}
            {/* Site (2026-10-16, mockups/site-ordinateur.html) : le pourboire est un choix comme les autres, il rejoint la colonne
                des choix ; le total du récapitulatif roule quand il change. L'app le garde en tête du récapitulatif. */}
            {!APPLI && blocPourboire}
            {/* Site : les codes, l'allergie, l'âge et les CGU sont des choix aussi — ils passent dans cette colonne, AVANT le
                récapitulatif et son bouton « Commander et payer » (dans l'ordre de lecture comme à l'écran), et le bouton reste
                sous les yeux, juste sous le total. L'app les garde en rangées et en feuilles (voir APPLI plus bas). */}
            {!APPLI && cart.count > 0 && (
              <div className="sc-codes">
                <details style={{ marginTop: 10 }} open={!!giftCode}>
                  <summary className="small" style={{ cursor: 'pointer' }}><Icone nom="cadeau" taille={14} /> {t('checkout.giftVoucherSummary')}</summary>
                  {champBonCadeau}
                </details>
                <CodePromoCheckout token={token} toast={toast} subtotal={totals.subtotal} deliveryFee={fulfillmentType === 'delivery' ? Math.max(0, totals.deliveryFee - totals.deliveryDiscount) : 0}
                  payOnSite={surPlaceChoisi} applique={codePromo} onChange={setCodePromo} />
                <CheckoutConformite restaurant={restaurant} lignes={Object.values(cart.lines)} typeCommande={fulfillmentType} valeur={conformite} onChange={setConformite} />
              </div>
            )}
            {/* « Continuer » n'existe pas à la dernière étape : là, c'est le bouton de paiement du
                récapitulatif qui prend le relais — deux actions principales sur le même écran
                feraient hésiter au moment le moins opportun. */}
          </div>
          </div>

          {(
          <aside className="checkout-recap">
          <BarreCommande montant={montantDebite}>
            {/* Dans la barre, au-dessus du montant : sur téléphone elle est fixée en bas de l'écran, un message placé après
                elle s'afficherait ailleurs que près du bouton. */}
            {refusDevis && <p className="co-refus" role="alert"><Icone nom="alerte" taille={16} className="icone-texte" /> {refusDevis}</p>}
            <span className="co-barre-total">
              <span className="co-barre-montant"><ChiffresRoulants valeur={euros(montantDebite)} /></span>
              <span className="co-barre-detail">{t(`checkout.barCount${devisValide ? 'Exact' : ''}${cart.count > 1 ? 'Plural' : ''}`, { count: cart.count })}</span>
            </span>
            {sansLivreur ? (
              <span className="small co-barre-attente"><Icone nom="horloge" taille={14} /> {t('checkout.noCourierNow')}</span>
            ) : serviceOuvert(fulfillmentType, user) && !paiementBloque && manqueMinimum > 0 ? (
              // Montant minimum du commerce (PAN-3) : le bouton laisse place à ce qui manque, comme le serveur le refuserait.
              <span className="small co-barre-attente">{t('checkout.minOrderMissing', { min: euros(restaurant.minOrderAmount), missing: euros(manqueMinimum) })}</span>
            ) : serviceOuvert(fulfillmentType, user) && !paiementBloque ? (
              <button className="btn-gold" disabled={placing || paying} onClick={placeOrder}>
                {placing || paying ? '...'
                  : surPlaceChoisi ? t('checkout.confirmOnSite')
                  : user?.simulation ? t('checkout.confirmAndPaySimulated') : t('checkout.confirmAndPay')}
              </button>
            ) : (
              <span className="small co-barre-attente"><Icone nom="horloge" taille={14} /> {paiementBloque
                ? t('checkout.onlinePaymentOpenSoon')
                : fulfillmentType === 'delivery'
                  ? t('checkout.deliveryOpenSoon')
                  : t('checkout.ordersOpenSoon', { date: dateOuvertureEmporter(getLocale()) })}</span>
            )}
            {/* Site, sous le bouton du récapitulatif (ordinateur seulement, site-commande.css) : qui encaisse. Pas pour un
                paiement sur place, que Stripe ne traite pas. */}
            {!APPLI && !surPlaceChoisi && <p className="sc-payer-note"><Icone nom="cadenas" taille={14} /> {t('siteCommande.stripe')}</p>}
          </BarreCommande>
          {cart.count > 0 && (
          <div className="card">
            {/* Le pourboire avant le récapitulatif (2026-10-16) : le choisir fait rouler le total de la barre. */}
            {APPLI && blocPourboire}
            <div className="co-recap-tete">
              <h3>{t('checkout.yourOrder')}<span className="co-recap-resto">{restaurant.name}</span></h3>
              <Link to={`/restaurants/${restaurantId}`} className="co-ajouter">{t('checkout.addMore')}</Link>
            </div>
            {Object.entries(cart.lines).map(([lineKey, line]) => {
              const item = restaurant.menu.find((m) => m.id === line.itemId) || { name: line.name };
              // Plat retiré de la carte ou en rupture : la ligne le dit (avant, elle disparaissait et le serveur refusait).
              if (ligneIndisponible(line, restaurant.menu)) {
                return (
                  <div key={lineKey} className="co-ligne co-ligne--indispo">
                    <span className="co-ligne-nom">{item.name}<span className="ligne-indispo">{t('checkout.unavailableToday')}</span></span>
                    <button type="button" className="btn-outline btn-sm" onClick={() => cart.removeLine(lineKey)}>{t('checkout.removeLine')}</button>
                  </div>
                );
              }
              return (
                <div key={lineKey} className="co-ligne">
                  <span className="co-ligne-nom">
                    {item.name}
                    <span className="co-ligne-prix">{euros(line.unitPrice * line.qty)}</span>
                    {line.optionsSnapshot?.length > 0 && (
                      <span className="small" style={{ display: 'block' }}>{line.optionsSnapshot.map((o) => o.name).join(', ')}</span>
                    )}
                    {line.note && <span className="small" style={{ display: 'block' }}>« {line.note} »</span>}
                  </span>
                  <div className="co-qte" role="group" aria-label={item.name}>
                    <button type="button" onClick={() => cart.changeLineQty(lineKey, -1)} aria-label={t('checkout.qtyLess')}>−</button>
                    <span aria-live="polite">{line.qty}</span>
                    <button type="button" onClick={() => cart.changeLineQty(lineKey, 1)} aria-label={t('checkout.qtyMore')}>+</button>
                  </div>
                </div>
              );
            })}
            <div className="divider" />
            <div className="breakdown">
              {/* Le vendeur de chaque ligne (trois vendeurs, C2) : ce récapitulatif est maintenant le dernier que le client
                  voit avant de payer quand le total ne bouge pas — il doit donc dire à qui il achète, comme la carte. */}
              <div className="line"><span>{t('common.subtotal')}<span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerFood', { name: restaurant.name })}</span></span><span>{euros(totals.rawSubtotal)}</span></div>
              {totals.discountedItems.map((d, i) => (
                <div className="line" key={i}><span><Icone nom="etiquette" taille={14} /> {d.name ? `${d.name} (${libellePromo(d.promo, t) || d.label})` : (libellePromo(d.promo, t) || d.label)}</span><span>-{euros(d.discount)}</span></div>
              ))}
              {fulfillmentType === 'delivery' && (
                <>
                  <div className="line"><span>{t('checkout.deliveryFeeLine')}{devisValide ? '' : ` (${t('checkout.fromPrefix')})`}<span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerDelivery')}</span></span><span>{euros(devisValide ? devisValide.deliveryFee : totals.deliveryFee)}</span></div>
                  {totals.deliveryDiscount > 0 && (
                    <div className="line"><span><Icone nom="scooter" taille={14} /> {t('checkout.deliveryDiscountLine', { name: restaurant.name })}</span><span>-{euros(totals.deliveryDiscount)}</span></div>
                  )}
                </>
              )}
              {/* TVA comprise, comme le total : la somme des lignes doit tomber sur le total affiché juste en dessous.
                  « dès » seulement en livraison, où la distance réelle peut encore faire monter la base. */}
              {fraisServiceEstimes > 0 && (
                <div className="line"><span className="small">{t('checkout.serviceFeeLine')}<span style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerServiceFee')}</span></span><span className="small">{euros(devisValide ? Number(devisValide.serviceFee || 0) + Number(devisValide.serviceFeeVat || 0) : fraisServiceEstimes)}</span></div>
              )}
              {/* Pas de ligne de commission côté client (demande du fondateur, 2026-09-15) : elle concerne le commerce, pas ce que paie le client. */}
              {soldeUtilise && user.balance > 0 && (
                <div className="line"><span>{t('checkout.balanceUsedLine')}</span><span>-{euros(Math.min(user.balance, estimatedTotalBeforeBalance))}</span></div>
              )}
              {/* Avec le devis du serveur, les remises qu'il a appliquées (bon cadeau, code promo) sont listées : la somme des lignes doit tomber sur le total. */}
              {devisValide?.giftVoucherDiscount > 0 && <div className="line"><span><Icone nom="cadeau" taille={14} /> {t('checkout.giftVoucherLine', { code: devisValide.giftVoucherCode })}</span><span>-{euros(devisValide.giftVoucherDiscount)}</span></div>}
              {pourboireChoisi > 0 && <div className="line"><span>{t('checkout.tipLine')}</span><span>{euros(pourboireChoisi)}</span></div>}
              {/* Sur le site, ce total est celui que l'on regarde (la barre n'y garde que le bouton) : ses chiffres roulent. */}
              <div className="line total"><span>{devisValide ? t('checkout.totalToPay') : t('checkout.estimatedTotal')}</span><span className="sc-roulant">{APPLI ? euros(montantDebite) : <ChiffresRoulants valeur={euros(montantDebite)} />}</span></div>
            </div>
            {user.balance > 0 && (
              <label className="row" style={{ gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={useBalance} onChange={(e) => setUseBalance(e.target.checked)} />
                <span className="small">{t('checkout.useBalance', { amount: Number(user.balance).toFixed(2) })}</span>
              </label>
            )}
            {APPLI ? (
              <>
                <button type="button" className="checkout-rangee" style={{ marginTop: 10 }} onClick={() => setSousEcran('codes')}>
                  <Icone nom="cadeau" taille={20} />
                  <span className="checkout-rangee-texte">
                    <span className="checkout-rangee-titre">{t('appli.coCodesTitre')}</span>
                    <span className="checkout-rangee-sous">{[codePromo?.code, giftCheck?.valid ? giftCode : null].filter(Boolean).join(' · ') || t('appli.coCodesSous')}</span>
                  </span>
                  <span className="checkout-rangee-chevron" aria-hidden="true">›</span>
                </button>
                <button type="button" className="checkout-rangee" onClick={() => setSousEcran('allergie')}>
                  <Icone nom="alerte" taille={20} />
                  <span className="checkout-rangee-texte">
                    <span className="checkout-rangee-titre">{t('conformite.allergyToggle')}</span>
                    <span className="checkout-rangee-sous">{conformite.allergyRequest?.trim() || t('appli.coAllergieSous')}</span>
                  </span>
                  <span className="checkout-rangee-chevron" aria-hidden="true">›</span>
                </button>
                {/* Seule instance qui lit la version des CGU : les feuilles ne font qu'afficher. */}
                <CheckoutConformite partie="infos" restaurant={restaurant} lignes={Object.values(cart.lines)} typeCommande={fulfillmentType} valeur={conformite} onChange={setConformite} />
              </>
            ) : null}
          </div>
          )}
          </aside>
          )}
        </div>
        </>
      )}

      {/* LES DEUX SOUS-ÉCRANS. Ils portent les mêmes champs qu'avant — rien n'a été réécrit, ils ont
          seulement quitté la page principale, qui n'en montre plus que le résumé. */}
      {/* La rangee d'adresse ouvre le CARNET, pas les quatre champs : c'est la meme question qu'en
          tete de la liste des commerces, donc le meme ecran. Les champs restent accessibles depuis
          le carnet, par la recherche. */}
      {sousEcran === 'adresse' && (
        <ChoixAdresse
          onFermer={() => setSousEcran(null)}
          onSaisieManuelle={() => setSousEcran('adresse-manuelle')}
          onChoisie={(a) => {
            setAddressStreet(a.street); setAddressNumber(a.number);
            setAddressPostalCode(a.postalCode); setAddressCity(a.city);
          }}
        />
      )}
      {/* Saisie à la main, ouverte depuis le carnet quand la recherche ne trouve pas la rue (audit du 15/10/2026). Le serveur
          géocode et refuse une adresse introuvable ou hors rayon : le refus s'affiche sous le bouton de paiement. */}
      {sousEcran === 'adresse-manuelle' && (
        <SousEcran titre={t('checkout.addressTitle')} onFermer={() => setSousEcran(null)} pied={
          <button type="button" className="btn-gold" style={{ width: '100%', minHeight: 48 }} onClick={() => {
            if (adresseIncomplete) { toast(t('checkout.toastAddressRequired'), 'erreur'); return; }
            setSousEcran(null);
          }}>{t('checkout.addressSave')}</button>
        }>
                {/* LA RECHERCHE D'ADRESSE, ENFIN ICI. Le composant existait déjà et servait à
                    l'inscription et à l'espace commerçant, mais PAS au paiement : le client tapait
                    ses quatre champs à la main, et « rue des cons, 1000 Bruxelles » passait sans
                    broncher. Les suggestions viennent de Photon/OpenStreetMap, filtrées sur la
                    Belgique (GET /restaurants/lookup/suggest) — aucune clé, aucun frais, et aucun
                    tiers de plus à déclarer dans la politique de confidentialité.
                    ⚠️ Cela AIDE à saisir une vraie adresse, cela ne l'impose pas : les champs restent
                    modifiables à la main, par choix — une adresse toute neuve peut manquer à la base
                    cartographique. Refuser une adresse introuvable ne peut se faire qu'au serveur. */}
                <AddressSearch onSelect={(a) => {
                  setAddressStreet(a.street);
                  if (a.number) setAddressNumber(a.number);
                  if (a.postalCode) setAddressPostalCode(a.postalCode);
                  if (a.city) setAddressCity(a.city);
                }} />
                <div className="field">
                  <label htmlFor="checkout-f-1">{t('auth.street')}</label>
                  <input id="checkout-f-1" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder={t('checkout.streetPlaceholder')} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="checkout-f-2">{t('auth.number')}</label>
                    <input id="checkout-f-2" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder={t('checkout.numberPlaceholder')} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="checkout-f-3">{t('auth.postalCode')}</label>
                    <input id="checkout-f-3" value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder={t('checkout.postalPlaceholder')} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="checkout-f-4">{t('auth.city')}</label>
                  <input id="checkout-f-4" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder={t('checkout.cityPlaceholder')} />
                </div>
        </SousEcran>
      )}
      {sousEcran === 'remise' && (
        <SousEcran titre={t('checkout.dropoffTitle')} onFermer={() => setSousEcran(null)} pied={
          <button type="button" className="btn-gold" style={{ width: '100%', minHeight: 48 }} onClick={() => setSousEcran(null)}>
            {t('checkout.dropoffSave')}
          </button>
        }>
                <div className="field">
                  {/* Un groupe de boutons, pas un champ : l'intitulé n'a rien à désigner par htmlFor. */}
                  <span className="field-intitule" id="checkout-consigne-label">{t('checkout.atDelivery')}</span>
                  <ChoixPastilles
                    libelle={t('checkout.atDelivery')}
                    valeur={deliveryInstructions}
                    onChange={setDeliveryInstructions}
                    options={DELIVERY_INSTRUCTION_OPTIONS.filter((o) => !(panierAlcool && o.value === 'deposer')).map((o) => ({
                      value: o.value,
                      label: deliveryInstructionLabel(o.value, t),
                      icone: <Icone nom={o.icon} taille={16} />
                    }))}
                  />
                  {panierAlcool && <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.noDoorDropAlcohol')}</p>}
                </div>
                <div className="field">
                  <label htmlFor="checkout-f-6">{t('checkout.driverNote')}</label>
                  <input id="checkout-f-6" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder={t('checkout.driverNotePlaceholder')} />
                </div>
        </SousEcran>
      )}

      {/* Application : les codes, l'allergie, et ce qu'il reste à cocher avant de payer (voir APPLI en tête de fichier). */}
      {sousEcran === 'codes' && (
        <SousEcran titre={t('appli.coCodesTitre')} onFermer={() => setSousEcran(null)} pied={
          <button type="button" className="btn-gold" style={{ width: '100%', minHeight: 48 }} onClick={() => setSousEcran(null)}>{t('appli.coValider')}</button>
        }>
          <span className="field-intitule"><Icone nom="cadeau" taille={16} className="icone-texte" /> {t('checkout.giftVoucherSummary')}</span>
          {champBonCadeau}
          <div style={{ marginTop: 18 }}>
            <CodePromoCheckout token={token} toast={toast} subtotal={totals.subtotal} deliveryFee={fulfillmentType === 'delivery' ? Math.max(0, totals.deliveryFee - totals.deliveryDiscount) : 0}
              payOnSite={surPlaceChoisi} applique={codePromo} onChange={setCodePromo} />
          </div>
        </SousEcran>
      )}
      {sousEcran === 'allergie' && (
        <SousEcran titre={t('conformite.allergyToggle')} onFermer={() => setSousEcran(null)} pied={
          <button type="button" className="btn-gold" style={{ width: '100%', minHeight: 48 }} onClick={() => setSousEcran(null)}>{t('appli.coValider')}</button>
        }>
          <CheckoutConformite partie="allergie" charger={false} restaurant={restaurant} lignes={Object.values(cart.lines)} typeCommande={fulfillmentType} valeur={conformite} onChange={setConformite} />
        </SousEcran>
      )}
      {sousEcran === 'avantCommande' && (
        <SousEcran titre={t('appli.coAvantTitre')} onFermer={() => setSousEcran(null)} pied={
          <button type="button" className="btn-gold" style={{ width: '100%', minHeight: 48 }} disabled={placing || paying} onClick={() => {
            const reste = manqueConformite(conformite, restaurant, Object.values(cart.lines), fulfillmentType, t);
            if (reste) { toast(reste); return; }
            setSousEcran(null); placeOrder();
          }}>{surPlaceChoisi ? t('checkout.confirmOnSite') : user?.simulation ? t('checkout.confirmAndPaySimulated') : t('checkout.confirmAndPay')}</button>
        }>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('appli.coAvantSous')}</p>
          <CheckoutConformite partie="cases" charger={false} restaurant={restaurant} lignes={Object.values(cart.lines)} typeCommande={fulfillmentType} valeur={conformite} onChange={setConformite} />
        </SousEcran>
      )}

      {pendingOrder && (
        <div className="card" ref={pendingOrderRef}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{t('checkout.confirmOrderTitle')}</h3>
          {/* La carte n'apparaît plus que quand le total du serveur diffère de celui du bouton (ou quand le paiement a
              échoué) : on commence donc par dire pourquoi elle est là. */}
          {totalAnnonce != null && Math.abs(Number(pendingOrder.total) - totalAnnonce) >= 0.005 && (
            <p className="small" style={{ margin: '0 0 10px', fontWeight: 600 }}>{t('checkout.totalChanged', { before: euros(totalAnnonce), after: euros(pendingOrder.total) })}</p>
          )}
          {pendingOrder.orderType === 'delivery' && !pendingOrder.scheduledFor && (
            <p className="small" style={{ margin: '0 0 10px' }}>{t('checkout.deliveryFeeNote')}</p>
          )}

          <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '12px 14px', margin: '0 0 14px' }}>
            {pendingOrder.orderType === 'delivery' && (
              <>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.addressLabel')}</b> {pendingOrder.address}</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.atDeliveryColon')}</b> {deliveryInstructionLabel(pendingOrder.deliveryInstructions, t)}</p>
                {pendingOrder.deliveryNote && <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.driverNoteColon')}</b> {pendingOrder.deliveryNote}</p>}
                {pendingOrder.scheduledFor ? (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.scheduledDeliveryFor')}</b> {new Date(pendingOrder.scheduledFor).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                ) : pendingOrder.estimatedDeliveryAt && (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.estimatedArrival')}</b> {new Date(pendingOrder.estimatedDeliveryAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            )}
            {pendingOrder.orderType === 'pickup' && (
              <>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.pickupAtColon')}</b> {restaurant.name}{restaurant.address ? `, ${restaurant.address}` : ''}</p>
                {pendingOrder.scheduledFor ? (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.readyForColon')}</b> {new Date(pendingOrder.scheduledFor).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                ) : pendingOrder.estimatedDeliveryAt && (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.pickupEstimateColon')}</b> {new Date(pendingOrder.estimatedDeliveryAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </>
            )}
          </div>

          {(
            <div className="breakdown">
              {/* Trois contrats, trois vendeurs (décision du 23/09/2026, C2) : chaque ligne dit à qui le client
                  achète. Le livreur n'est pas encore connu ici — il sera nommé dès qu'il accepte la course. */}
              <div className="line"><span>{t('common.subtotal')}<span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerFood', { name: restaurant.name })}</span></span><span>{euros(pendingOrder.subtotal)}</span></div>
              {pendingOrder.promoDiscount > 0 && <div className="line"><span>{t('checkout.promoLine', { label: pendingOrder.promoLabel })}</span><span>-{euros(pendingOrder.promoDiscount)}</span></div>}
              {pendingOrder.orderType === 'delivery' && (
                <>
                  <div className="line"><span>{t('checkout.deliveryFeeLine')}<span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerDelivery')}</span></span><span>{euros(pendingOrder.deliveryFee)}</span></div>
                  {pendingOrder.deliveryDiscount > 0 && (
                    <div className="line"><span><Icone nom="scooter" taille={14} /> {t('checkout.deliveryDiscountLine', { name: restaurant.name })}</span><span>-{euros(pendingOrder.deliveryDiscount)}</span></div>
                  )}
                  <div className="line"><span>{t('checkout.serviceFeeLine')}<span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerServiceFee')}</span></span><span>{euros(pendingOrder.serviceFee + (pendingOrder.serviceFeeVat || 0))}</span></div>
                </>
              )}
              {pendingOrder.giftVoucherDiscount > 0 && <div className="line"><span><Icone nom="cadeau" taille={14} /> {t('checkout.giftVoucherLine', { code: pendingOrder.giftVoucherCode })}</span><span>-{euros(pendingOrder.giftVoucherDiscount)}</span></div>}
              {pendingOrder.promoCodeDiscount > 0 && <div className="line"><span>{t('checkout.promoCodeRecap', { label: pendingOrder.promoCode })}</span><span>-{euros(pendingOrder.promoCodeDiscount)}</span></div>}
              {pendingOrder.balanceUsed > 0 && <div className="line"><span>{t('checkout.balanceUsedLine')}</span><span>-{euros(pendingOrder.balanceUsed)}</span></div>}
              {(() => {
                // Même règle que confirmAndPay : le pourboire n'est débité qu'en livraison, sur un total non nul.
                const tipCarte = pendingOrder.orderType === 'delivery' && Number(pendingOrder.total) > 0 ? pourboireChoisi : 0;
                return (
                  <>
                    {tipCarte > 0 && <div className="line"><span>{t('checkout.tipLine')}</span><span>{euros(tipCarte)}</span></div>}
                    <div className="line total"><span>{pendingOrder.paymentMode === 'on_site' ? t('checkout.toPayOnSite') : t('checkout.totalToPay')}</span><span>{euros(Number(pendingOrder.total) + tipCarte)}</span></div>
                  </>
                );
              })()}
            </div>
          )}

          {pendingOrder.allergyRequest && (
            <p className="small" style={{ margin: '0 0 8px' }}><b>{t('conformite.allergyRecapLabel')}</b> « {pendingOrder.allergyRequest} » — {t('conformite.allergyRecapPending')}</p>
          )}
          {pendingOrder.containsAlcohol && (
            <p className="small" style={{ margin: '0 0 8px' }}>{t('conformite.ageRecap', { age: pendingOrder.minAge || 18 })}</p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn-gold" disabled={paying || cancelling} onClick={() => confirmAndPay()}>
              {paying ? '...'
                : pendingOrder.paymentMode === 'on_site' ? t('checkout.confirmOnSite')
                : user?.simulation ? t('checkout.confirmAndPaySimulated') : t('checkout.confirmAndPay')}
            </button>
            <button className="btn-ghost" disabled={paying || cancelling} onClick={cancelOrder}>{cancelling ? '...' : t('common.cancel')}</button>
          </div>
        </div>
      )}
      </FeuilleCommande>
    </div>
  );
}
