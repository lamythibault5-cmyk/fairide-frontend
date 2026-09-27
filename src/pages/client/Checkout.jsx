import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { DELIVERY_INSTRUCTION_OPTIONS, deliveryInstructionLabel } from '../../orderStatus';
import Icone from '../../components/Icone';
import ChoixPastilles from '../../components/ChoixPastilles';
import EnteteFlux from '../../components/EnteteFlux';
import SousEcran from '../../components/SousEcran';
import AddressSearch from '../../components/AddressSearch';
import ChoixAdresse from '../../components/ChoixAdresse';
import { getScheduleDateOptions, getScheduleTimeOptions } from '../../scheduleUtils';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { serviceOuvert, dateOuverture, paiementEnLigneOuvert, dateOuverturePaiementEnLigne } from '../../launch';
import CheckoutConformite from '../../components/conformite/CheckoutConformite';
import { manqueConformite } from '../../conformite';

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
  const [addressStreet, setAddressStreet] = useState(user.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(user.addressNumber || '');
  const [addressPostalCode, setAddressPostalCode] = useState(user.addressPostalCode || '');
  const [addressCity, setAddressCity] = useState(user.addressCity || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState('sonner');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [useBalance, setUseBalance] = useState(true);
  // À emporter chez un commerce qui l'accepte : payer au retrait plutôt qu'en ligne.
  const [paiementSurPlace, setPaiementSurPlace] = useState(false);
  // Bon cadeau du commerce (vendu au comptoir, voir Promotions → Bons cadeaux côté restaurateur) :
  // vérifié à la saisie, déduit côté serveur à la création de la commande.
  const [giftCode, setGiftCode] = useState('');
  const [giftCheck, setGiftCheck] = useState(null);
  const [fulfillmentType, setFulfillmentType] = useState('delivery');
  // Sous-ecran ouvert par-dessus le paiement : 'adresse', 'remise', ou null.
  const [sousEcran, setSousEcran] = useState(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [dateOptions] = useState(() => getScheduleDateOptions(7, libellesDates));
  const [placing, setPlacing] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paying, setPaying] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Allergie, âge, CGU (backlog de conformité C1, C3, A1) — voir components/conformite/CheckoutConformite.jsx.
  const [conformite, setConformite] = useState({ allergyRequest: '', ageDeclaration: false, acceptTerms: false, termsNeeded: false, termsVersion: '' });
  const pendingOrderRef = useRef(null);
  const fulfillmentInitRef = useRef(false);

  const restaurantId = cart.restaurantId;

  useEffect(() => {
    if (!restaurantId || cart.count === 0) {
      navigate('/restaurants');
      return;
    }
    api(`/restaurants/${restaurantId}`).then(setRestaurant).catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Corrige le type de commande par défaut (initialisé à 'delivery' avant même de savoir ce que ce
  // restaurant propose) une fois ses services chargés — une seule fois, pour ne pas écraser un choix
  // déjà fait par le client si le restaurant est rechargé ensuite.
  useEffect(() => {
    if (!restaurant || fulfillmentInitRef.current) return;
    fulfillmentInitRef.current = true;
    // Commerce sans livraison ni à emporter (commande en ligne fermée) : retour à sa fiche, le panier est conservé.
    if (!restaurant.offersDelivery && !restaurant.offersPickup) {
      toast(t('checkout.toastNoOnlineOrder'));
      navigate(`/restaurants/${restaurantId}`);
      return;
    }
    // Livraison pas encore ouverte (avant le 20 octobre) : l'à emporter est proposé d'abord.
    if (!restaurant.offersDelivery || (!serviceOuvert('delivery', user) && restaurant.offersPickup)) { setFulfillmentType('pickup'); return; }
    // Sinon, le mode choisi sur la fiche du commerce (RestaurantMenu, sessionStorage) est repris.
    let choisi = null;
    try { choisi = sessionStorage.getItem(`fairide_mode_${restaurantId}`); } catch { /* navigation privée */ }
    if (choisi === 'pickup' && restaurant.offersPickup) setFulfillmentType('pickup');
  }, [restaurant]);

  useEffect(() => {
    if (pendingOrder && pendingOrderRef.current) {
      pendingOrderRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [pendingOrder]);

  // L'etape « dessert/boisson » a quitte le paiement : elle est maintenant sur la page Panier, avant
  // d'y entrer. On arrive donc directement sur la confirmation des informations de commande.

  if (notFound) return <div className="empty">{t('checkout.notAvailable')}</div>;
  if (!restaurant) return <SkeletonCards count={2} />;

  const totals = cart.totals(restaurant.menu, restaurant.activeCartPromo, { freeDelivery: restaurant.freeDelivery, deliveryFeeDiscount: restaurant.deliveryFeeDiscount, freeDeliveryMinOrder: restaurant.freeDeliveryMinOrder });
  // Mode choisi par le commerce : en ligne seulement, sur place seulement, ou au choix du client.
  const modeEmporter = restaurant.pickupPaymentMode || (restaurant.pickupPayOnSite ? 'both' : 'online');
  // Avant le 20 octobre, l'à emporter ne se paie que sur place : si le commerce laisse le choix, « sur place » est
  // imposé ; s'il n'accepte que le paiement en ligne, la commande attend l'ouverture.
  const enLigneFerme = fulfillmentType === 'pickup' && !paiementEnLigneOuvert(user);
  const surPlaceChoisi = fulfillmentType === 'pickup' && (modeEmporter === 'on_site' || (modeEmporter === 'both' && (paiementSurPlace || enLigneFerme)));
  // Frais de service (10 % de la livraison + TVA, voir src/fraisService.js) : en livraison seulement. La part de Fairide
  // sur les plats est déjà dans les prix affichés.
  const fraisServiceEstimes = fulfillmentType === 'delivery' ? totals.serviceFee : 0;
  const estimatedTotalBeforeBalance = fulfillmentType === 'delivery' ? totals.total : totals.subtotal;
  const paiementBloque = enLigneFerme && modeEmporter === 'online';
  const soldeUtilise = useBalance && !surPlaceChoisi;
  const estimatedTotal = Math.max(0, estimatedTotalBeforeBalance - (soldeUtilise ? Math.min(user.balance || 0, estimatedTotalBeforeBalance) : 0));
  const scheduleTimeOptions = scheduleDate ? getScheduleTimeOptions(scheduleDate) : [];
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
   * RIEN DE LA LOGIQUE N'A BOUGÉ : ni placeOrder, ni confirmAndPay, ni la validation. C'est le
   * chemin de l'argent ; refaire la présentation ne doit pas être l'occasion d'en réécrire le fond.
   *
   * `sousEcran` vaut 'adresse', 'remise' ou null. Voir components/SousEcran.jsx. */
  const adresseIncomplete = !addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim();
  const adresseResume = adresseIncomplete
    ? ''
    : `${addressStreet.trim()} ${addressNumber.trim()}, ${addressPostalCode.trim()} ${addressCity.trim()}`;

  async function placeOrder() {
    if (fulfillmentType === 'delivery' && (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim())) {
      toast(t('checkout.toastAddressRequired'));
      return;
    }
    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) {
      toast(t('checkout.toastScheduledDateTimeRequired'));
      return;
    }
    // Commande programmée : heure locale.
    const scheduledForISO = scheduleEnabled ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString() : null;
    const items = Object.values(cart.lines).map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds }));
    const manque = manqueConformite(conformite, restaurant, Object.values(cart.lines), fulfillmentType, t);
    if (manque) { toast(manque); return; }
    setPlacing(true);
    try {
      // Les frais de livraison dépendent de la distance réelle et ne sont connus qu'une fois la commande
      // créée côté serveur — on affiche donc le total exact avant de rediriger vers le paiement.
      const surPlace = surPlaceChoisi;
      const order = await api('/orders', {
        method: 'POST', token,
        body: {
          restaurantId, items, orderType: fulfillmentType,
          paymentChoice: surPlace ? 'on_site' : undefined,
          scheduledFor: scheduledForISO,
          ...(fulfillmentType === 'delivery' ? {
            addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
            addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
            deliveryInstructions, deliveryNote: deliveryNote.trim()
          } : {}),
          useBalance: useBalance && !surPlace,
          giftVoucherCode: giftCheck?.valid ? giftCode.trim() : undefined,
          allergyRequest: conformite.allergyRequest.trim() || undefined, ageDeclaration: conformite.ageDeclaration || undefined,
          ...(conformite.termsNeeded ? { acceptTerms: conformite.acceptTerms, termsVersion: conformite.termsVersion } : {})
        }
      });
      if (order.balanceUsed > 0) refreshUser().catch(() => {});
      setDeliveryConfirmed(false);
      setPendingOrder(order);
    } catch (e) {
      // CGU passées à une nouvelle version entre l'ouverture de la page et le clic : on affiche la case.
      if (e.code === 'CGU_A_ACCEPTER') setConformite((c) => ({ ...c, termsNeeded: true, acceptTerms: false, termsVersion: e.data?.termsVersion || c.termsVersion }));
      toast(e.message, 'erreur');
    } finally {
      setPlacing(false);
    }
  }

  async function confirmAndPay() {
    setPaying(true);
    try {
      // Paiement sur place : rien à encaisser en ligne, la commande part au commerce.
      if (pendingOrder.paymentMode === 'on_site') {
        await api(`/orders/${pendingOrder.id}/confirm-on-site`, { method: 'POST', token });
        cart.clear();
        toast(t('checkout.toastOnSiteConfirmed'));
        navigate('/orders');
        return;
      }
      const pay = await api(`/payments/checkout/${pendingOrder.id}`, { method: 'POST', token });
      if (pay.simulated) {
        // Chemin simulé : le paiement est acquis immédiatement, donc vider le panier ici est correct.
        cart.clear();
        toast(t('checkout.toastOrderPaid'));
        navigate('/orders');
      } else {
        // Le panier est mis de côté, pas vidé et pas laissé en place — voir stashForPayment() dans
        // CartContext.jsx pour le raisonnement complet. En résumé : le vider ici faisait perdre son
        // panier à tout client qui abandonnait ou dont la carte était refusée (le bug d'origine) ;
        // le laisser en place lui laissait un panier d'articles déjà payés s'il ne revenait jamais
        // sur la page de retour. La copie mise de côté est restaurée ou supprimée par OrderResult.jsx,
        // une fois l'issue réellement connue.
        cart.stashForPayment();
        window.location.href = pay.checkoutUrl;
      }
    } catch (e) {
      toast(e.message, 'erreur');
      setPaying(false);
    }
  }

  async function cancelOrder() {
    setCancelling(true);
    try {
      await api(`/orders/${pendingOrder.id}/cancel`, { method: 'PATCH', token });
      toast(t('checkout.toastOrderCancelled'));
      setPendingOrder(null);
      if (pendingOrder.balanceUsed > 0) refreshUser().catch(() => {});
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      {/* Le retour mène au PANIER, et non plus directement à la carte du commerce : c'est l'écran
          d'où l'on vient, donc celui qu'on s'attend à retrouver en reculant. Revenir à la carte pour
          ajouter un plat reste possible — c'est « Ajouter un plat », dans la barre de récapitulatif
          plus bas, qui garde ce rôle. */}
      <EnteteFlux vers="/panier" titre={t('checkout.headerTitle')} libelle={t('panier.title')} />


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
              <span className="titre-groupe" id="checkout-fulfillment-label">{t('checkout.howToGet')}</span>
              {/* Des CARTES sélectionnables, pas une rangée de pilules — c'est le motif
                  « Priority / Standard / Schedule » de la capture 3 : une icône, un titre, et
                  l'option retenue cernée d'une arête iris. Trois pilules côte à côte se lisaient
                  comme trois boutons d'égale importance, alors qu'il s'agit d'un choix unique. */}
              <div className="choix-cartes" role="group" aria-labelledby="checkout-fulfillment-label">
                {cart.count > 0 && (
                  <>
                    {restaurant.offersDelivery && (
                      <button type="button" className={`choix-carte${fulfillmentType === 'delivery' ? ' est-actif' : ''}`} aria-pressed={fulfillmentType === 'delivery'} onClick={() => selectFulfillment('delivery')}>
                        <Icone nom="scooter" taille={20} /><span>{t('orderStatus.orderType.delivery')}</span>
                      </button>
                    )}
                    {restaurant.offersPickup && (
                      <button type="button" className={`choix-carte${fulfillmentType === 'pickup' ? ' est-actif' : ''}`} aria-pressed={fulfillmentType === 'pickup'} onClick={() => selectFulfillment('pickup')}>
                        <Icone nom="sac" taille={20} /><span>{t('orderStatus.orderType.pickup')}</span>
                      </button>
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
            {/* LE COMMERCE CHOISIT LE MODE DE PAIEMENT A EMPORTER (modeEmporter, pose par main) :
                en ligne seulement, sur place seulement, ou au choix du client. Quand il n'y a pas de
                choix a faire, on l'annonce au lieu d'afficher une bascule a une seule option — c'est
                une information, pas une question. */}
            {fulfillmentType === 'pickup' && modeEmporter === 'on_site' && (
              <div className="paiement-encart" style={{ marginBottom: 10 }}>
                <p className="small" style={{ margin: 0 }}><b><Icone nom="billet" taille={16} /> {t('checkout.payOnSiteOnly')}</b></p>
                <p className="small" style={{ margin: '4px 0 0' }}>{t('checkout.payOnSiteNote')}</p>
              </div>
            )}
            {/* C'etaient deux boutons radio natifs, dont la cible utile etait la pastille de 13px
                dessinee par le navigateur. Ils deviennent des pastilles, comme le reste du
                formulaire. */}
            {fulfillmentType === 'pickup' && modeEmporter === 'both' && (
              <div className="field">
                <span className="field-intitule">{t('checkout.payWhen')}</span>
                <ChoixPastilles
                  libelle={t('checkout.payWhen')}
                  valeur={paiementSurPlace || enLigneFerme ? 'sur_place' : 'en_ligne'}
                  onChange={(v) => { if (!(enLigneFerme && v === 'en_ligne')) setPaiementSurPlace(v === 'sur_place'); }}
                  options={[
                    { value: 'en_ligne', label: enLigneFerme ? t('checkout.payOnlineFrom', { date: dateOuverturePaiementEnLigne(getLocale()) }) : t('checkout.payOnline'), icone: <Icone nom="carteBancaire" taille={16} /> },
                    { value: 'sur_place', label: t('checkout.payOnSite'), icone: <Icone nom="billet" taille={16} /> }
                  ]}
                />
                {(paiementSurPlace || enLigneFerme) && <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.payOnSiteNote')}</p>}
              </div>
            )}
            {/* QUAND LA RECEVOIR — deux cartes, comme le bloc « Delivery options » des captures.
                C'était une case à cocher isolée, qu'on ne lisait pas : maintenant les deux réponses
                possibles sont posées côte à côte et l'une est visiblement retenue.
                Il n'y a pas de troisième carte « Prioritaire » : Fairide n'a pas d'option de
                livraison payante plus rapide, et on n'invente pas une fonctionnalité pour faire
                joli — il n'existe même aucun champ de délai de préparation, ni ici ni au serveur. */}
            {(
              <div className="field">
                <span className="titre-groupe" id="checkout-quand-label">{t('checkout.whenLabel')}</span>
                <div className="choix-cartes" role="group" aria-labelledby="checkout-quand-label">
                  <button
                    type="button"
                    className={`choix-carte${!scheduleEnabled ? ' est-actif' : ''}`}
                    aria-pressed={!scheduleEnabled}
                    onClick={() => { setScheduleEnabled(false); setScheduleDate(''); setScheduleTime(''); }}
                  >
                    <Icone nom="scooter" taille={20} />
                    <span>{t('checkout.whenAsap')}</span>
                  </button>
                  <button
                    type="button"
                    className={`choix-carte${scheduleEnabled ? ' est-actif' : ''}`}
                    aria-pressed={scheduleEnabled}
                    onClick={() => { setScheduleEnabled(true); setScheduleDate(dateOptions[0].value); setScheduleTime(''); }}
                  >
                    <Icone nom="horloge" taille={20} />
                    <span>{t('checkout.scheduleLater')}</span>
                  </button>
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
            {/* « Continuer » n'existe pas à la dernière étape : là, c'est le bouton de paiement du
                récapitulatif qui prend le relais — deux actions principales sur le même écran
                feraient hésiter au moment le moins opportun. */}
          </div>
          </div>

          {(
          <aside className="checkout-recap">
          <div className="cart-bar">
            <Link to={`/restaurants/${restaurantId}`} className="btn-ghost">{t('checkout.addDish')}</Link>
            <span>{cart.count > 0 ? t(cart.count > 1 ? 'checkout.itemsCountFromPlural' : 'checkout.itemsCountFrom', { count: cart.count, total: estimatedTotal.toFixed(2) }) : ''}</span>
            {serviceOuvert(fulfillmentType, user) && !paiementBloque ? (
              <button className="btn-gold" disabled={placing} onClick={placeOrder}>
                {placing ? '...' : t('checkout.validateInfo')}
              </button>
            ) : (
              <span className="small" style={{ fontWeight: 600 }}><Icone nom="horloge" taille={14} /> {paiementBloque
                ? t('checkout.onlinePaymentOpenSoon', { date: dateOuverturePaiementEnLigne(getLocale()) })
                : fulfillmentType === 'delivery'
                  ? t('checkout.deliveryOpenSoon', { date: dateOuverture('delivery', getLocale()) })
                  : t('checkout.ordersOpenSoon', { date: dateOuverture('pickup', getLocale()) })}</span>
            )}
          </div>
          {cart.count > 0 && (
          <div className="card">
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('checkout.yourOrder')}</h3>
            {Object.entries(cart.lines).map(([lineKey, line]) => {
              const item = restaurant.menu.find((m) => m.id === line.itemId);
              if (!item) return null;
              return (
                <div key={lineKey} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
                  <span>
                    {line.qty}× {item.name}
                    {line.optionsSnapshot?.length > 0 && (
                      <span className="small" style={{ display: 'block' }}>{line.optionsSnapshot.map((o) => o.name).join(', ')}</span>
                    )}
                  </span>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => cart.changeLineQty(lineKey, -1)}>−</button>
                    <span>{line.qty}</span>
                    <button className="btn-outline" style={{ padding: '4px 10px' }} onClick={() => cart.changeLineQty(lineKey, 1)}>+</button>
                  </div>
                </div>
              );
            })}
            <div className="divider" />
            <div className="breakdown">
              <div className="line"><span>{t('common.subtotal')}</span><span>{totals.rawSubtotal.toFixed(2)}€</span></div>
              {totals.discountedItems.map((d, i) => (
                <div className="line" key={i}><span><Icone nom="etiquette" taille={14} /> {d.name ? `${d.name} (${d.label})` : d.label}</span><span>-{d.discount.toFixed(2)}€</span></div>
              ))}
              {fulfillmentType === 'delivery' && (
                <>
                  <div className="line"><span>{t('checkout.deliveryFeeLine')} ({t('checkout.fromPrefix')})</span><span>{totals.deliveryFee.toFixed(2)}€</span></div>
                  {totals.deliveryDiscount > 0 && (
                    <div className="line"><span><Icone nom="scooter" taille={14} /> {t('checkout.deliveryDiscountLine', { name: restaurant.name })}</span><span>-{totals.deliveryDiscount.toFixed(2)}€</span></div>
                  )}
                </>
              )}
              {/* TVA comprise, comme le total : la somme des lignes doit tomber sur le total affiché juste en dessous.
                  « dès » seulement en livraison, où la distance réelle peut encore faire monter la base. */}
              {fraisServiceEstimes > 0 && (
                <div className="line"><span>{t('checkout.serviceFeeLine')}{fulfillmentType === 'delivery' ? ` (${t('checkout.fromPrefix')})` : ''}</span><span>{fraisServiceEstimes.toFixed(2)}€</span></div>
              )}
              {/* Pas de ligne de commission côté client (demande du fondateur, 2026-09-15) : elle concerne le commerce, pas ce que paie le client. */}
              {soldeUtilise && user.balance > 0 && (
                <div className="line"><span>{t('checkout.balanceUsedLine')}</span><span>-{Math.min(user.balance, estimatedTotalBeforeBalance).toFixed(2)}€</span></div>
              )}
              <div className="line total"><span>{t('checkout.estimatedTotal')}</span><span>{estimatedTotal.toFixed(2)}€</span></div>
            </div>
            {user.balance > 0 && (
              <label className="row" style={{ gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={useBalance} onChange={(e) => setUseBalance(e.target.checked)} />
                <span className="small">{t('checkout.useBalance', { amount: Number(user.balance).toFixed(2) })}</span>
              </label>
            )}
            <details style={{ marginTop: 10 }} open={!!giftCode}>
              <summary className="small" style={{ cursor: 'pointer' }}><Icone nom="cadeau" taille={14} /> {t('checkout.giftVoucherSummary')}</summary>
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
            </details>
            <CheckoutConformite restaurant={restaurant} lignes={Object.values(cart.lines)} typeCommande={fulfillmentType} valeur={conformite} onChange={setConformite} />
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
          onChoisie={(a) => {
            setAddressStreet(a.street); setAddressNumber(a.number);
            setAddressPostalCode(a.postalCode); setAddressCity(a.city);
          }}
        />
      )}
      {false && (
        <SousEcran titre={t('checkout.addressTitle')} onFermer={() => setSousEcran(null)} pied={
          <button type="button" className="btn-gold" style={{ width: '100%', minHeight: 48 }} onClick={() => {
            if (adresseIncomplete) { toast(t('checkout.toastAddressRequired')); return; }
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
                    options={DELIVERY_INSTRUCTION_OPTIONS.map((o) => ({
                      value: o.value,
                      label: deliveryInstructionLabel(o.value, t),
                      icone: <Icone nom={o.icon} taille={16} />
                    }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="checkout-f-6">{t('checkout.driverNote')}</label>
                  <input id="checkout-f-6" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder={t('checkout.driverNotePlaceholder')} />
                </div>
        </SousEcran>
      )}

      {pendingOrder && (
        <div className="card" ref={pendingOrderRef}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{t('checkout.confirmOrderTitle')}</h3>
          {pendingOrder.orderType === 'delivery' && !pendingOrder.scheduledFor && (
            <p className="small" style={{ margin: '0 0 10px' }}>{t('checkout.deliveryFeeNote')}</p>
          )}

          <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '12px 14px', margin: '0 0 14px' }}>
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '0 0 8px' }}>
              <input
                type="checkbox"
                checked={deliveryConfirmed}
                onChange={(e) => setDeliveryConfirmed(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span className="small" style={{ fontWeight: 600 }}>
                {pendingOrder.orderType === 'delivery' && t('checkout.confirmDeliveryInfo')}
                {pendingOrder.orderType === 'pickup' && t('checkout.confirmPickupSelf')}
              </span>
            </label>
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
              <div className="line"><span>{t('common.subtotal')}<span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerFood', { name: restaurant.name })}</span></span><span>{pendingOrder.subtotal.toFixed(2)}€</span></div>
              {pendingOrder.promoDiscount > 0 && <div className="line"><span>{t('checkout.promoLine', { label: pendingOrder.promoLabel })}</span><span>-{pendingOrder.promoDiscount.toFixed(2)}€</span></div>}
              {pendingOrder.orderType === 'delivery' && (
                <>
                  <div className="line"><span>{t('checkout.deliveryFeeLine')}<span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerDelivery')}</span></span><span>{pendingOrder.deliveryFee.toFixed(2)}€</span></div>
                  {pendingOrder.deliveryDiscount > 0 && (
                    <div className="line"><span><Icone nom="scooter" taille={14} /> {t('checkout.deliveryDiscountLine', { name: restaurant.name })}</span><span>-{pendingOrder.deliveryDiscount.toFixed(2)}€</span></div>
                  )}
                  <div className="line"><span>{t('checkout.serviceFeeLine')}<span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.sellerServiceFee')}</span></span><span>{pendingOrder.serviceFee.toFixed(2)}€</span></div>
                </>
              )}
              {pendingOrder.giftVoucherDiscount > 0 && <div className="line"><span><Icone nom="cadeau" taille={14} /> {t('checkout.giftVoucherLine', { code: pendingOrder.giftVoucherCode })}</span><span>-{pendingOrder.giftVoucherDiscount.toFixed(2)}€</span></div>}
              {pendingOrder.balanceUsed > 0 && <div className="line"><span>{t('checkout.balanceUsedLine')}</span><span>-{pendingOrder.balanceUsed.toFixed(2)}€</span></div>}
              <div className="line total"><span>{pendingOrder.paymentMode === 'on_site' ? t('checkout.toPayOnSite') : t('checkout.totalToPay')}</span><span>{pendingOrder.total.toFixed(2)}€</span></div>
            </div>
          )}

          {pendingOrder.allergyRequest && (
            <p className="small" style={{ margin: '0 0 8px' }}><b>{t('conformite.allergyRecapLabel')}</b> « {pendingOrder.allergyRequest} » — {t('conformite.allergyRecapPending')}</p>
          )}
          {pendingOrder.containsAlcohol && (
            <p className="small" style={{ margin: '0 0 8px' }}>{t('conformite.ageRecap', { age: pendingOrder.minAge || 18 })}</p>
          )}
          {!deliveryConfirmed && (
            <p className="small" style={{ margin: '0 0 8px', color: 'var(--red)' }}>{t('checkout.confirmCheckboxWarning')}</p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn-gold" disabled={paying || cancelling || !deliveryConfirmed} onClick={confirmAndPay}>
              {paying ? '...'
                : pendingOrder.paymentMode === 'on_site' ? t('checkout.confirmOnSite')
                : t('checkout.confirmAndPay')}
            </button>
            <button className="btn-ghost" disabled={paying || cancelling} onClick={cancelOrder}>{cancelling ? '...' : t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
