import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { DELIVERY_INSTRUCTION_OPTIONS, deliveryInstructionLabel } from '../../orderStatus';
import Icone from '../../components/Icone';
import ChoixPastilles from '../../components/ChoixPastilles';
import EnteteFlux from '../../components/EnteteFlux';
import { getScheduleDateOptions, getScheduleTimeOptions } from '../../scheduleUtils';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { serviceOuvert, dateOuverture } from '../../launch';

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
  const location = useLocation();
  const { t } = useLanguage();
  const libellesDates = { today: t('checkout.dateToday'), tomorrow: t('checkout.dateTomorrow') };
  // Arrivée via "Réserver une table" depuis la page du restaurant : réservation seule, sans articles
  // au panier — le client valide juste ses infos de réservation, envoyées au restaurant sans paiement.
  const reservationOnly = !!location.state?.reservationOnly;

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
  // Bon cadeau du commerce (vendu au comptoir, voir Réservations → Bons cadeaux côté restaurateur) :
  // vérifié à la saisie, déduit côté serveur à la création de la commande.
  const [giftCode, setGiftCode] = useState('');
  const [giftCheck, setGiftCheck] = useState(null);
  const [fulfillmentType, setFulfillmentType] = useState(reservationOnly ? 'dine_in' : 'delivery');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(reservationOnly ? getScheduleDateOptions(7, libellesDates)[0].value : '');
  const [scheduleTime, setScheduleTime] = useState('');
  const [dateOptions] = useState(() => getScheduleDateOptions(7, libellesDates));
  const [partySize, setPartySize] = useState(2);
  const [reservationName, setReservationName] = useState(user.name || '');
  const [reservationNote, setReservationNote] = useState('');
  // Où le client préfère être installé : '' (peu importe), 'inside' ou 'outside'. Une préférence, pas
  // une condition — le serveur replie sur une autre zone et le dit dans la confirmation.
  const [zonePreference, setZonePreference] = useState('');
  // Disponibilité réelle du restaurant pour la date et le groupe choisis (créneaux libres, règles,
  // acompte) — voir GET /restaurants/:id/availability. Remplace la grille fixe 9h–22h pour la table.
  const [dispo, setDispo] = useState(null);
  const [dispoChargement, setDispoChargement] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paying, setPaying] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pendingOrderRef = useRef(null);
  const fulfillmentInitRef = useRef(false);

  // Réservation seule (bouton "Réserver une table") : le panier n'a jamais reçu d'article pour ce
  // restaurant, donc cart.restaurantId peut être vide — on retombe alors sur l'id transmis explicitement
  // par le bouton (voir RestaurantMenu.jsx) plutôt que de rediriger vers /restaurants à tort.
  const restaurantId = cart.restaurantId || (reservationOnly ? location.state?.restaurantId : null);

  useEffect(() => {
    if (!restaurantId || (cart.count === 0 && !reservationOnly)) {
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
    if (reservationOnly) {
      if (!restaurant.offersDineIn) {
        toast(t('checkout.toastNoReservation'));
        navigate(`/restaurants/${restaurantId}`);
      }
      return;
    }
    // Restaurant passé en réservation seule alors que le client avait déjà un panier : le repli vers
    // 'dine_in' laissait passer une commande de plats en ligne, exactement ce que le restaurateur vient
    // d'interdire — et ce que sa fiche annonce au client. On le renvoie vers la fiche, d'où part le
    // parcours de réservation. Le panier est conservé : il redeviendra valable si le restaurant
    // rouvre la commande en ligne.
    if (!restaurant.offersDelivery && !restaurant.offersPickup) {
      toast(t('checkout.toastNoOnlineOrder'));
      navigate(`/restaurants/${restaurantId}`);
      return;
    }
    // Livraison pas encore ouverte (avant le 15 octobre) : l'à emporter est proposé d'abord.
    if (!restaurant.offersDelivery || (!serviceOuvert('delivery', user) && restaurant.offersPickup)) setFulfillmentType('pickup');
  }, [restaurant]);

  useEffect(() => {
    if (pendingOrder && pendingOrderRef.current) {
      pendingOrderRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [pendingOrder]);

  // L'etape « dessert/boisson » a quitte le paiement : elle est maintenant sur la page Panier, avant
  // d'y entrer. On arrive donc directement sur la confirmation des informations de commande.

  // Créneaux libres pour la date et le groupe : rechargés à chaque changement de l'un ou l'autre. Le
  // créneau déjà choisi est conservé s'il reste disponible, effacé sinon (on ne laisse pas partir
  // une réservation sur une heure devenue complète). Déclaré AVANT les sorties anticipées ci-dessous,
  // comme tout hook : l'ordre des hooks doit être le même à chaque rendu.
  useEffect(() => {
    if (fulfillmentType !== 'dine_in' || !restaurantId || !scheduleDate || !partySize) { setDispo(null); return undefined; }
    let annule = false;
    setDispoChargement(true);
    api(`/restaurants/${restaurantId}/availability?date=${scheduleDate}&partySize=${Number(partySize)}${zonePreference ? `&zone=${zonePreference}` : ''}`)
      .then((d) => {
        if (annule) return;
        setDispo(d);
        setScheduleTime((h) => (h && d.creneaux?.some((c) => c.heure === h && c.disponible) ? h : ''));
      })
      .catch((e) => { if (!annule) { setDispo(null); toast(e.message); } })
      .finally(() => { if (!annule) setDispoChargement(false); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillmentType, restaurantId, scheduleDate, partySize, zonePreference]);

  if (notFound) return <div className="empty">{t('checkout.notAvailable')}</div>;
  if (!restaurant) return <SkeletonCards count={2} />;

  const totals = cart.totals(restaurant.menu, restaurant.activeCartPromo, { freeDelivery: restaurant.freeDelivery, deliveryFeeDiscount: restaurant.deliveryFeeDiscount, freeDeliveryMinOrder: restaurant.freeDeliveryMinOrder });
  // À emporter : pas de frais de livraison/système, contrairement à l'estimation par défaut de cart.totals().
  const estimatedTotalBeforeBalance = fulfillmentType === 'delivery' ? totals.total : totals.subtotal;
  // Mode choisi par le commerce : en ligne seulement, sur place seulement, ou au choix du client.
  const modeEmporter = restaurant.pickupPaymentMode || (restaurant.pickupPayOnSite ? 'both' : 'online');
  const surPlaceChoisi = fulfillmentType === 'pickup' && (modeEmporter === 'on_site' || (modeEmporter === 'both' && paiementSurPlace));
  const soldeUtilise = useBalance && !surPlaceChoisi;
  const estimatedTotal = Math.max(0, estimatedTotalBeforeBalance - (soldeUtilise ? Math.min(user.balance || 0, estimatedTotalBeforeBalance) : 0));
  const scheduleTimeOptions = scheduleDate ? getScheduleTimeOptions(scheduleDate) : [];
  const scheduledPreview = scheduleDate && scheduleTime
    ? new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null;
  const isPureReservation = pendingOrder?.orderType === 'dine_in' && pendingOrder.items.length === 0;
  // Réservation : les jours proposés vont jusqu'à l'horizon du restaurant, les heures sont ses
  // créneaux réellement libres. Le créneau choisi porte son instant exact (heure de Bruxelles) et
  // l'acompte qui s'y applique (il dépend de la table qui serait attribuée).
  const dateOptionsResa = fulfillmentType === 'dine_in' ? getScheduleDateOptions(restaurant?.reservationMaxDays || 7, libellesDates) : dateOptions;
  const creneauChoisi = dispo?.creneaux?.find((c) => c.heure === scheduleTime) || null;
  const acompteDu = creneauChoisi ? creneauChoisi.acompte : (dispo?.acompte?.montant || 0);

  function selectFulfillment(type) {
    setFulfillmentType(type);
    if (type === 'dine_in') {
      setScheduleEnabled(false);
      if (!scheduleDate) setScheduleDate(dateOptions[0].value);
      setScheduleTime('');
    } else {
      setScheduleEnabled(false);
      setScheduleDate('');
      setScheduleTime('');
    }
  }

  async function placeOrder() {
    if (fulfillmentType === 'delivery' && (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim())) {
      toast(t('checkout.toastAddressRequired'));
      return;
    }
    if (fulfillmentType === 'dine_in') {
      if (!scheduleDate || !scheduleTime) {
        toast(t('checkout.toastReservationDateTimeRequired'));
        return;
      }
      if (!partySize || partySize < 1) {
        toast(t('checkout.toastPartySizeRequired'));
        return;
      }
      if (!reservationName.trim()) {
        toast(t('checkout.toastReservationNameRequired'));
        return;
      }
    }
    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) {
      toast(t('checkout.toastScheduledDateTimeRequired'));
      return;
    }
    const isScheduled = fulfillmentType === 'dine_in' || scheduleEnabled;
    // Table : l'instant vient du créneau serveur (heure de Bruxelles, quel que soit le fuseau du
    // téléphone) ; commande programmée : heure locale, comme avant.
    const scheduledForISO = isScheduled
      ? (fulfillmentType === 'dine_in' && creneauChoisi ? creneauChoisi.debut : new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString())
      : null;
    const items = Object.values(cart.lines).map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds }));
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
          ...(fulfillmentType === 'dine_in' ? { partySize: Number(partySize), reservationName: reservationName.trim(), reservationNote: reservationNote.trim(), zonePreference: zonePreference || null } : {}),
          useBalance: useBalance && !surPlace,
          giftVoucherCode: giftCheck?.valid ? giftCode.trim() : undefined
        }
      });
      if (order.balanceUsed > 0) refreshUser().catch(() => {});
      setDeliveryConfirmed(false);
      setPendingOrder(order);
    } catch (e) {
      toast(e.message);
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
      // Réservation avec acompte : c'est l'acompte qu'on encaisse (la commande est à 0 €) ; le serveur
      // confirme la table dès qu'il est payé. Sinon, le parcours de paiement habituel.
      const acompteAPayer = pendingOrder.orderType === 'dine_in' && pendingOrder.reservationDepositStatus === 'pending' && pendingOrder.reservationDepositAmount > 0;
      const pay = await api(acompteAPayer ? `/payments/deposit-checkout/${pendingOrder.id}` : `/payments/checkout/${pendingOrder.id}`, { method: 'POST', token });
      if (pay.simulated) {
        // Chemin simulé : le paiement est acquis immédiatement, donc vider le panier ici est correct.
        cart.clear();
        toast(isPureReservation ? t('checkout.toastReservationSent') : t('checkout.toastOrderPaid'));
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
      toast(e.message);
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
      toast(e.message);
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
            <div className="field">
              {/* Intitulé d'un GROUPE de boutons, pas d'un champ unique : un htmlFor n'aurait rien à
                  désigner. role="group" + aria-labelledby fait annoncer « Comment la recevoir » avant
                  les options, au lieu de trois boutons sans contexte. */}
              <span className="titre-groupe" id="checkout-fulfillment-label">{cart.count === 0 ? t('checkout.yourReservation') : t('checkout.howToGet')}</span>
              {/* Des CARTES sélectionnables, pas une rangée de pilules — c'est le motif
                  « Priority / Standard / Schedule » de la capture 3 : une icône, un titre, et
                  l'option retenue cernée d'une arête iris. Trois pilules côte à côte se lisaient
                  comme trois boutons d'égale importance, alors qu'il s'agit d'un choix unique. */}
              <div className="choix-cartes" role="group" aria-labelledby="checkout-fulfillment-label">
                {restaurant.offersDineIn && (
                  <button type="button" className={`choix-carte${fulfillmentType === 'dine_in' ? ' est-actif' : ''}`} aria-pressed={fulfillmentType === 'dine_in'} onClick={() => selectFulfillment('dine_in')}>
                    <Icone nom="restaurants" taille={20} /><span>{t('orderStatus.orderType.dineIn')}</span>
                  </button>
                )}
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
            {fulfillmentType === 'delivery' && (
              <>
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
              </>
            )}
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
                  valeur={paiementSurPlace ? 'sur_place' : 'en_ligne'}
                  onChange={(v) => setPaiementSurPlace(v === 'sur_place')}
                  options={[
                    { value: 'en_ligne', label: t('checkout.payOnline'), icone: <Icone nom="carteBancaire" taille={16} /> },
                    { value: 'sur_place', label: t('checkout.payOnSite'), icone: <Icone nom="billet" taille={16} /> }
                  ]}
                />
                {paiementSurPlace && <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.payOnSiteNote')}</p>}
              </div>
            )}
            {fulfillmentType === 'dine_in' && (
              <>
                <p className="small" style={{ margin: '0 0 10px' }}>{t('checkout.dineInHere', { name: restaurant.name, address: restaurant.address ? `, ${restaurant.address}` : '' })}</p>
                <div className="field">
                  {/* Deux champs (jour + heure) sous un seul intitulé : groupe, et chaque select reçoit
                      en plus son propre aria-label pour être identifiable une fois le focus dessus. */}
                  <span className="field-intitule" id="checkout-reservation-label">{t('checkout.reservationDateTime')}</span>
                  <ChoixPastilles
                    libelle={t('checkout.reservationDateTime')}
                    valeur={scheduleDate}
                    onChange={(v) => { setScheduleDate(v); setScheduleTime(''); }}
                    options={dateOptionsResa.map((d) => ({ value: d.value, label: d.label }))}
                  />
                  {/* Les créneaux pleins restent visibles mais désactivés : voir qu'il y avait 20h30 et que
                      c'est complet aide à choisir 19h30, là où une liste amputée laisse croire que le
                      restaurant ferme tôt. C'est justement ce qu'une liste déroulante ne montrait pas :
                      il fallait l'ouvrir pour découvrir quels créneaux existaient. */}
                  {dispoChargement ? (
                    <p className="small" style={{ margin: '8px 0 0' }}>{t('checkout.loadingSlots')}</p>
                  ) : (
                    <ChoixPastilles
                      libelle={t('checkout.timePlaceholder')}
                      valeur={scheduleTime}
                      onChange={setScheduleTime}
                      options={(dispo?.creneaux || []).map((c) => ({
                        value: c.heure,
                        label: c.heure,
                        disabled: !c.disponible,
                        note: !c.disponible
                          ? (c.raison === 'complet' ? t('checkout.slotFull') : c.raison === 'trop_tot' ? t('checkout.slotTooSoon') : t('checkout.slotUnavailable'))
                          : (c.acompte > 0 ? `${c.acompte.toFixed(2)}€` : null)
                      }))}
                    />
                  )}
                  {!dispoChargement && dispo && dispo.raison && (
                    <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>
                      {t(`checkout.noSlotsReason_${dispo.raison}`, { max: dispo.maxCouverts })}
                    </p>
                  )}
                  {!dispoChargement && dispo && !dispo.raison && !dispo.creneaux.some((c) => c.disponible) && (
                    <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{t('checkout.noSlotsToday')}</p>
                  )}
                  {scheduledPreview && (
                    <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.reservationForPreview', { preview: scheduledPreview })}</p>
                  )}
                  {dispo?.regles?.messageAccueil && (
                    <p className="small" style={{ margin: '8px 0 0', padding: '8px 10px', background: 'var(--cream-dim)', borderRadius: 9 }}><Icone nom="bulle" taille={14} /> {dispo.regles.messageAccueil}</p>
                  )}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="checkout-f-7">{t('checkout.partySize')}</label>
                    <input id="checkout-f-7"
                      type="number" min="1" max={dispo?.maxCouverts || 30}
                      value={partySize}
                      onChange={(e) => setPartySize(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div className="field" style={{ flex: 2 }}>
                    <label htmlFor="checkout-f-8">{t('checkout.reservationName')}</label>
                    <input id="checkout-f-8" value={reservationName} onChange={(e) => setReservationName(e.target.value)} placeholder={t('checkout.reservationNamePlaceholder')} />
                  </div>
                </div>
                {/* Intérieur ou terrasse : « Terrasse » n'apparaît que si la salle en a une. */}
                <div className="field">
                  <span className="small" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('checkout.zoneQuestion')}</span>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label={t('checkout.zoneQuestion')}>
                    {[['', 'zoneAny'], ['inside', 'zoneInside'], ...((restaurant.hasOutsideTables || dispo?.zones?.outside) ? [['outside', 'zoneOutside']] : [])].map(([valeur, cle]) => (
                      <button type="button" key={cle} className={zonePreference === valeur ? 'btn-gold' : 'btn-outline'} style={{ padding: '6px 12px', fontSize: 13 }}
                        aria-pressed={zonePreference === valeur} onClick={() => setZonePreference(valeur)}>
                        {valeur === 'inside' ? <Icone nom="maison" taille={15} /> : valeur === 'outside' ? <Icone nom="soleil" taille={15} /> : null}{t(`checkout.${cle}`)}
                      </button>
                    ))}
                  </div>
                  {zonePreference && creneauChoisi && creneauChoisi.zoneDisponible === false && (
                    <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.zoneNotAtThisTime', { zone: t(zonePreference === 'outside' ? 'checkout.zoneOutside' : 'checkout.zoneInside') })}</p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="checkout-f-9">{t('checkout.reservationNote')}</label>
                  <input id="checkout-f-9" value={reservationNote} maxLength={500} onChange={(e) => setReservationNote(e.target.value)} placeholder={t('checkout.reservationNotePlaceholder')} />
                </div>
                {/* Ce que le client s'engage à quoi, avant de valider : acompte (déduit sur place),
                    délai d'annulation, et confirmation manuelle éventuelle. */}
                {dispo && !dispo.raison && (
                  <div className="small" style={{ margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {cart.count === 0 && acompteDu > 0 && (
                      <span>{t('checkout.depositInfo', { amount: `${acompteDu.toFixed(2)}€` })}{dispo.acompte?.note ? ` ${dispo.acompte.note}` : ''}</span>
                    )}
                    <span>{dispo.regles.annulationHeures > 0 ? t('checkout.cancelPolicy', { hours: dispo.regles.annulationHeures }) : t('checkout.cancelPolicyUntilStart')}</span>
                    {!dispo.regles.confirmationAuto && <span>{t('checkout.awaitsConfirmation')}</span>}
                  </div>
                )}
              </>
            )}
            {fulfillmentType !== 'dine_in' && (
              <div className="field">
                <label className="row" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={scheduleEnabled}
                    onChange={(e) => {
                      setScheduleEnabled(e.target.checked);
                      if (e.target.checked) { setScheduleDate(dateOptions[0].value); setScheduleTime(''); }
                      else { setScheduleDate(''); setScheduleTime(''); }
                    }}
                  />
                  <span>{t('checkout.scheduleLater')}</span>
                </label>
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
          </div>
          </div>

          <aside className="checkout-recap">
          <div className="cart-bar">
            <Link to={`/restaurants/${restaurantId}`} className="btn-ghost">{t('checkout.addDish')}</Link>
            <span>{cart.count > 0 ? t(cart.count > 1 ? 'checkout.itemsCountFromPlural' : 'checkout.itemsCountFrom', { count: cart.count, total: estimatedTotal.toFixed(2) }) : t('checkout.reservationNoOrder')}</span>
            {serviceOuvert(fulfillmentType, user) ? (
              <button className="btn-gold" disabled={placing} onClick={placeOrder}>
                {placing ? '...' : cart.count === 0 ? t('checkout.sendReservation') : t('checkout.validateInfo')}
              </button>
            ) : (
              <span className="small" style={{ fontWeight: 600 }}><Icone nom="reservations" taille={14} /> {fulfillmentType === 'dine_in'
                ? t('checkout.reservationsOpenSoon', { date: dateOuverture('dine_in', getLocale()) })
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
                  {/* TVA comprise : la ligne affichait les frais hors TVA alors que le total, lui, la contenait —
                      la somme des lignes ne tombait jamais sur le total affiché juste en dessous. */}
                  <div className="line"><span>{t('checkout.serviceFeeLine')} ({t('checkout.fromPrefix')})</span><span>{(totals.serviceFee + totals.serviceFeeVat).toFixed(2)}€</span></div>
                </>
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
                <input aria-label={t('checkout.giftVoucherPh')} value={giftCode} placeholder={t('checkout.giftVoucherPh')} maxLength={20} style={{ flex: '1 1 160px', textTransform: 'uppercase' }}
                  onChange={(e) => { setGiftCode(e.target.value.toUpperCase()); setGiftCheck(null); }} aria-label={t('checkout.giftVoucherSummary')} />
                <button type="button" className="btn-outline" style={{ padding: '6px 12px' }} disabled={giftCode.trim().length < 6 || giftCheck === 'loading'}
                  onClick={async () => {
                    setGiftCheck('loading');
                    try { setGiftCheck(await api(`/restaurants/${restaurantId}/gift-vouchers/check?code=${encodeURIComponent(giftCode.trim())}`, { token })); }
                    catch (e) { setGiftCheck(null); toast(e.message); }
                  }}>{giftCheck === 'loading' ? '…' : t('checkout.giftVoucherCheck')}</button>
              </div>
              {giftCheck && giftCheck !== 'loading' && (
                <p className="small" style={{ margin: '6px 0 0', color: giftCheck.valid ? 'var(--teal-deep)' : 'var(--red)' }}>
                  {giftCheck.valid ? t('checkout.giftVoucherOk', { amount: Number(giftCheck.remaining).toFixed(2) }) : t(`checkout.giftVoucherKo_${giftCheck.reason || 'introuvable'}`)}
                </p>
              )}
            </details>
          </div>
          )}
          </aside>
        </div>
        </>
      )}

      {pendingOrder && (
        <div className="card" ref={pendingOrderRef}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{isPureReservation ? t('checkout.confirmReservationTitle') : t('checkout.confirmOrderTitle')}</h3>
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
                {pendingOrder.orderType === 'dine_in' && t('checkout.confirmReservation')}
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
            {pendingOrder.orderType === 'dine_in' && (
              <>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.tableAtColon')}</b> {restaurant.name}{restaurant.address ? `, ${restaurant.address}` : ''}</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.reservedNameOfColon')}</b> {pendingOrder.reservationName}</p>
                <p className="small" style={{ margin: '0 0 4px' }}><b>{t('checkout.partySizeColon')}</b> {pendingOrder.partySize}</p>
                {(pendingOrder.tableNumber != null || pendingOrder.tableName) && (
                  <p className="small" style={{ margin: '0 0 4px' }}>
                    <b>{t('checkout.tableColon')}</b>{' '}
                    {pendingOrder.tableNumber != null ? t('checkout.tableNumber', { n: pendingOrder.tableNumber }) : pendingOrder.tableName}
                    {pendingOrder.tableZone ? ` · ${t(`checkout.zoneLabel_${pendingOrder.tableZone}`)}` : ''}
                    {pendingOrder.zoneRespected === false && <span style={{ color: 'var(--ink-soft)' }}> · {t('checkout.zoneFallback')}</span>}
                  </p>
                )}
                {pendingOrder.scheduledFor && (
                  <p className="small" style={{ margin: 0 }}><b>{t('checkout.reservedForColon')}</b> {new Date(pendingOrder.scheduledFor).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                )}
                {pendingOrder.reservationNote && (
                  <p className="small" style={{ margin: '4px 0 0' }}><b>{t('checkout.noteColon')}</b> {pendingOrder.reservationNote}</p>
                )}
              </>
            )}
          </div>

          {/* Acompte : la seule somme due maintenant sur une réservation sans plats. Montant figé par le
              serveur à la création (voir routes/orders.js), c'est lui qu'on affiche et qu'on encaisse. */}
          {isPureReservation && pendingOrder.reservationDepositAmount > 0 && (
            <div className="breakdown">
              <div className="line total"><span>{t('checkout.depositLine')}</span><span>{pendingOrder.reservationDepositAmount.toFixed(2)}€</span></div>
            </div>
          )}

          {!isPureReservation && (
            <div className="breakdown">
              <div className="line"><span>{t('common.subtotal')}</span><span>{pendingOrder.subtotal.toFixed(2)}€</span></div>
              {pendingOrder.promoDiscount > 0 && <div className="line"><span>{t('checkout.promoLine', { label: pendingOrder.promoLabel })}</span><span>-{pendingOrder.promoDiscount.toFixed(2)}€</span></div>}
              {pendingOrder.orderType === 'delivery' && (
                <>
                  <div className="line"><span>{t('checkout.deliveryFeeLine')}</span><span>{pendingOrder.deliveryFee.toFixed(2)}€</span></div>
                  {pendingOrder.deliveryDiscount > 0 && (
                    <div className="line"><span><Icone nom="scooter" taille={14} /> {t('checkout.deliveryDiscountLine', { name: restaurant.name })}</span><span>-{pendingOrder.deliveryDiscount.toFixed(2)}€</span></div>
                  )}
                  <div className="line"><span>{t('checkout.serviceFeeLine')}</span><span>{pendingOrder.serviceFee.toFixed(2)}€</span></div>
                </>
              )}
              {pendingOrder.giftVoucherDiscount > 0 && <div className="line"><span><Icone nom="cadeau" taille={14} /> {t('checkout.giftVoucherLine', { code: pendingOrder.giftVoucherCode })}</span><span>-{pendingOrder.giftVoucherDiscount.toFixed(2)}€</span></div>}
              {pendingOrder.balanceUsed > 0 && <div className="line"><span>{t('checkout.balanceUsedLine')}</span><span>-{pendingOrder.balanceUsed.toFixed(2)}€</span></div>}
              <div className="line total"><span>{pendingOrder.paymentMode === 'on_site' ? t('checkout.toPayOnSite') : t('checkout.totalToPay')}</span><span>{pendingOrder.total.toFixed(2)}€</span></div>
            </div>
          )}

          {!deliveryConfirmed && (
            <p className="small" style={{ margin: '0 0 8px', color: 'var(--red)' }}>{t('checkout.confirmCheckboxWarning')}</p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn-gold" disabled={paying || cancelling || !deliveryConfirmed} onClick={confirmAndPay}>
              {paying ? '...'
                : isPureReservation && pendingOrder.reservationDepositAmount > 0 ? t('checkout.payDepositAndReserve', { amount: `${pendingOrder.reservationDepositAmount.toFixed(2)}€` })
                : isPureReservation ? t('checkout.sendReservation')
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
