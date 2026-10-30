import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dateOuverturePaiements, paiementsOuverts } from '../../launch';
import { experienceApp } from '../../natif';

/* RELIRE ET VALIDER LA CARTE, d'où qu'on parte (étape « Relis et valide ta carte », Ma carte) : la page « C'est bon », la même
 * que celle envoyée par SMS. Une seule page de validation, quel que soit le chemin (fondateur, 2026-10-27 : « on ne peut pas
 * avoir deux processus qui font la même chose » ; Ma carte signait encore la carte elle-même, par une autre route). */
export async function ouvrirValidationCarte({ restaurant, restoId, token, navigate, onChange, toast, t }) {
  if (restaurant?.menuSigned) {
    // Carte signée avant le correctif du 15/10 mais jamais confirmée : la confirmation seule suffit.
    await api(`/restaurants/${restoId}/menu/confirm`, { method: 'POST', token, body: {} });
    await onChange?.();
    toast(t('menuPage.handoverConfirmed'), 'succes');
    return;
  }
  const l = await api(`/restaurants/${restoId}/menu-validation-link`, { method: 'POST', token });
  navigate(`/carte/valider/${l.token}`);
}

/* LES ÉTAPES « AVANT D'ÊTRE EN LIGNE » (voir l'en-tête de MiseEnLigne.jsx pour l'ordre et les règles). Calcul seul, sans
 * rendu : la rangée « Prochaine étape » des pages du tableau de bord et la route de Mon commerce (EditPage) le partagent.
 * Chaque étape : { cle, icone, titre, sous?, fait?, attente?, action?: { libelle, to | onClick, disabled } }. */
// Les étapes, dans l'ordre, et la prochaine que le commerce peut faire ; null s'il n'y a rien à montrer.
export default function useMiseEnLigne({ restaurant, restoId, token, onConnect, connecting, onChange, lectureSeule = false }) {
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const [conformite, setConformite] = useState(null);
  const [demandeCarte, setDemandeCarte] = useState(null);
  // Questions de Fairide sur la carte (questionsCarte.js) : { open, waiting }. Relues avec la fiche.
  const [questions, setQuestions] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const o = restaurant?.onboarding;
  const nbPlats = (restaurant?.menu || []).length;

  // Les engagements (allergènes, déclaration pro) ne sont pas dans la fiche : même route que ConformiteCarte. Relue à
  // chaque rechargement de la fiche (un prix changé remet la carte à signer, une signature la complète).
  useEffect(() => {
    if (!restoId || restaurant?.isDemo) return;
    api(`/restaurants/${restoId}/compliance`, { token }).then(setConformite).catch(() => setConformite(null));
  }, [restoId, token, restaurant]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!restoId || restaurant?.isDemo || nbPlats === 0) return;
    api(`/restaurants/${restoId}/menu-questions`, { token }).then(setQuestions).catch(() => setQuestions(null));
  }, [restoId, token, restaurant, nbPlats]); // eslint-disable-line react-hooks/exhaustive-deps
  // Carte vide : une demande « Fairide s'en occupe » déjà envoyée change l'étape 1 d'« à faire » en « on attend ».
  useEffect(() => {
    if (!restoId || nbPlats > 0) return;
    api(`/restaurants/${restoId}/menu/concierge`, { token }).then((r) => setDemandeCarte(r.request || null)).catch(() => setDemandeCarte(null));
  }, [restoId, token, nbPlats]);

  if (!restaurant || !o || restaurant.isDemo || restaurant.adminStatus === 'blocked') return null;

  async function validerCarte() {
    setOccupe(true);
    try {
      await ouvrirValidationCarte({ restaurant, restoId, token, navigate, onChange, toast, t });
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  const engagementsOk = !!o.contractAccepted && (!conformite || (
    !!conformite.allergens?.attestation?.attestedAt && !!conformite.professional?.declaredAt && conformite.professional?.upToDate !== false));
  const stripeRestreint = restaurant.stripeConnectStatus === 'restricted';

  // `action` : ce que le commerce peut faire maintenant ({ libelle, to } ou { libelle, onClick }) ; `attente` : étape de
  // Fairide, sans bouton. Une étape faite n'a ni l'un ni l'autre.
  // « Compte créé » d'abord, toujours fait (fondateur, 2026-10-30, maquettes/progression) : c'est vrai, et une étape déjà cochée
  // donne envie de finir (Nunes & Drèze, 2006). « 1 étape faite sur 7 » au lieu de « 0 sur 6 ».
  const etapes = [{ cle: 'compte', fait: true, icone: 'commerce', titre: t('miseEnLigne.accountDone') }];
  // « Fairide prépare ta carte » seulement pour une demande encore ouverte : annulée, refusée ou close sans plat, le
  // commerce attendait pour rien (audit du 19/10, shop-8). Il retrouve « Envoie-nous ta carte ».
  const demandeOuverte = demandeCarte && ['en_attente', 'en_cours'].includes(demandeCarte.status);
  etapes.push(nbPlats > 0
    ? { cle: 'carte', fait: true, icone: 'carte', titre: t('miseEnLigne.menuDone', { n: nbPlats }) }
    : demandeOuverte
      ? { cle: 'carte', attente: true, icone: 'horloge', titre: t('miseEnLigne.menuPreparing'), sous: t('miseEnLigne.menuPreparingSub') }
      : { cle: 'carte', icone: 'carte', titre: t('miseEnLigne.menuSend'), sous: t('miseEnLigne.menuSendSub'), action: { libelle: t('miseEnLigne.menuSendBtn'), to: experienceApp() ? '/dashboard/menu?envoyer=1' : '/dashboard/menu' } });
  // Questions de Fairide sur la carte (2026-10-20) : AVANT la validation — une réponse peut changer la carte, et la valider
  // d'abord obligerait à la re-signer. Tant que les réponses attendent d'être reportées, la validation attend aussi.
  const nbQuestions = questions?.open?.length || 0;
  const reponsesEnAttente = !nbQuestions && (questions?.waiting || 0) > 0;
  if (nbPlats > 0 && nbQuestions) {
    etapes.push({ cle: 'questions', icone: 'bulle', titre: t('miseEnLigne.questions', { n: nbQuestions }), sous: t('miseEnLigne.questionsSub'),
      action: { libelle: t('miseEnLigne.questionsBtn'), to: '/dashboard/questions' } });
  }
  // Un commerce vitrine ne vend pas : rien à signer (même règle que l'ancien bandeau CarteAValider).
  if (!restaurant.vitrine && nbPlats > 0) {
    const carteValidee = restaurant.menuSigned && !o.menuPending;
    // Carte déjà signée une fois, puis changée (TVA, allergènes, modification faite par l'équipe…) sur un commerce en ligne :
    // TOUTES ses commandes sont refusées jusqu'à la nouvelle validation (routes/orders.js). On le dit en ces mots (audit du
    // 19/10, shop-11 et shop-12), pas « Relis et valide ta carte » comme à la première mise en ligne.
    const commandesArretees = !restaurant.menuSigned && restaurant.menuEverSigned && restaurant.publicListed;
    etapes.push(carteValidee
      ? { cle: 'valider', fait: true, icone: 'valider', titre: t('miseEnLigne.validateDone') }
      : (nbQuestions || reponsesEnAttente)
        ? { cle: 'valider', attente: true, icone: 'valider', titre: t('miseEnLigne.validate'), sous: t(reponsesEnAttente ? 'miseEnLigne.validateAfterUpdate' : 'miseEnLigne.validateAfterQuestions') }
      : { cle: 'valider', icone: 'valider', titre: t(commandesArretees ? 'miseEnLigne.validateStopped' : 'miseEnLigne.validate'), sous: t(commandesArretees ? 'miseEnLigne.validateStoppedSub' : 'miseEnLigne.validateSub'),
          action: { libelle: occupe ? '…' : t('miseEnLigne.validateBtn'), onClick: validerCarte, disabled: occupe } });
  }
  // Nouvelle version du contrat pour un commerce déjà en ligne (audit du 19/10, shop-15) : la date limite et ce qui se passe
  // ensuite, au lieu de « Signe tes engagements · avant d'être visible des clients » alors qu'il l'est.
  const renouveler = !o.contractAccepted && o.contractRenewal && restaurant.publicListed ? o.contractRenewal : null;
  const jourLong = (iso) => new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
  etapes.push(engagementsOk
    ? { cle: 'engagements', fait: true, icone: 'contrat', titre: t('miseEnLigne.commitmentsDone') }
    : { cle: 'engagements', icone: 'contrat',
        titre: renouveler ? t('miseEnLigne.contractRenew', { date: jourLong(renouveler.inForceAt) }) : t('miseEnLigne.commitments'),
        sous: renouveler ? t('miseEnLigne.contractRenewSub', { date: jourLong(renouveler.graceEndsAt) }) : t('miseEnLigne.commitmentsSub'),
        // Un seul écran pour les trois textes, en haut d'une page à lui (EngagementsPage.jsx, 2026-10-27) : avant, Mon compte ›
        // contrat (feuille ouverte sur une page défilée) ou le milieu de Ma carte (#conformite-carte), dans un long texte.
        action: { libelle: t('miseEnLigne.commitmentsBtn'), to: '/dashboard/engagements' } });
  // À emporter payé sur place seulement : rien ne transite par Fairide, pas d'étape paiements (formules.paiementsRequis).
  if (o.paymentsRequired !== false) {
    const actif = restaurant.stripeConnectStatus === 'active';
    /* QUATRE ÉTATS STRIPE (audit du 19/10, shop-5). « pending » (formulaire envoyé, Stripe vérifie : relu une fois par page,
     * DashboardLayout.jsx) ressemblait à « pas commencé », bouton lime compris : le commerce refaisait tout ou croyait à un
     * échec. Refusé par Stripe (« rejected », migration 063 côté serveur) n'avait pas d'état. Les deux sont des étapes
     * d'attente, sans bouton ; « restricted » (Stripe veut une pièce de plus) garde « Compléter ». */
    const stripeEnVerification = restaurant.stripeConnectStatus === 'pending';
    const stripeRefuse = restaurant.stripeConnectStatus === 'rejected';
    etapes.push(actif
      ? { cle: 'paiements', fait: true, icone: 'carteBancaire', titre: t('miseEnLigne.paymentsDone') }
      : stripeEnVerification
        ? { cle: 'paiements', attente: true, icone: 'carteBancaire', titre: t('miseEnLigne.paymentsPending'), sous: t('miseEnLigne.paymentsPendingSub') }
      : stripeRefuse
        ? { cle: 'paiements', attente: true, icone: 'carteBancaire', titre: t('miseEnLigne.paymentsRejected'), sous: t('miseEnLigne.paymentsRejectedSub') }
      : (stripeRestreint || paiementsOuverts())
        ? { cle: 'paiements', icone: 'carteBancaire', titre: stripeRestreint ? t('dashResto.paymentInfoTitle') : t('miseEnLigne.payments'),
            sous: stripeRestreint ? t('dashResto.stripeNeedsInfoResto') : t('miseEnLigne.paymentsSub'),
            action: { libelle: connecting ? '…' : (stripeRestreint ? t('dashResto.complete') : t('dashResto.paymentsConfigureBtn')), onClick: onConnect, disabled: connecting } }
        // Activation pas encore ouverte : ce n'est pas une action possible aujourd'hui, on dit quand.
        : { cle: 'paiements', attente: true, icone: 'carteBancaire', titre: t('miseEnLigne.payments'),
            sous: t('dashResto.viaStripeResto', { date: dateOuverturePaiements(getLocale()) }) });
  }
  etapes.push(restaurant.adminStatus === 'approved'
    ? { cle: 'verification', fait: true, icone: 'bouclier', titre: t('miseEnLigne.checkDone') }
    : { cle: 'verification', attente: true, icone: 'bouclier', titre: t('miseEnLigne.check'), sous: t('miseEnLigne.checkSub') });
  // Retiré du site par l'équipe : la date et le motif, plus « automatique » (audit du 19/10, shop-13 ; P2B art. 4). Il ne
  // revient pas tout seul (publicationAuto.js) : l'équipe le republie, il répond à l'e-mail qui lui a donné le motif.
  const retrait = restaurant.removedByTeam;
  etapes.push(restaurant.publicListed
    ? { cle: 'enLigne', fait: true, icone: 'globe', titre: t('miseEnLigne.listedDone') }
    : retrait
      ? { cle: 'enLigne', attente: true, icone: 'globe',
          titre: retrait.at ? t('miseEnLigne.removedOn', { date: new Date(retrait.at).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long' }) }) : t('miseEnLigne.removed'),
          sous: `${retrait.reason ? `${t('miseEnLigne.removedReason', { reason: retrait.reason })} ` : ''}${t('miseEnLigne.removedSub')}` }
      : { cle: 'enLigne', attente: true, icone: 'globe', titre: t('miseEnLigne.listed'), sous: t('miseEnLigne.listedSub') });
  /* PUBLIÉ MAIS COMMANDES FERMÉES (audit du 19/10, shop-304). Un commerce inscrit sans horaires est créé fermé (le serveur
   * pose des horaires 11:00–22:00 et open = false), tout comme celui qui a touché « Fermer jusqu'à ce que je rouvre » : une
   * fois publié, toutes ses étapes étaient cochées et la puce disait « En ligne », alors qu'il n'apparaît pas aux clients
   * tant que l'interrupteur des commandes reste fermé. Une dernière étape le dit, avec le geste qui ouvre. */
  if (restaurant.publicListed && restaurant.open === false) {
    const ouvrir = async () => {
      setOccupe(true);
      try {
        await api(`/restaurants/${restoId}`, { method: 'PATCH', token, body: { open: true } });
        await onChange?.();
        toast(t('miseEnLigne.openOrdersDone'), 'succes');
      } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
    };
    etapes.push({ cle: 'ouvrir', icone: 'horloge', titre: t('miseEnLigne.openOrders'), sous: t('miseEnLigne.openOrdersSub'),
      action: { libelle: occupe ? '…' : t('miseEnLigne.openOrdersBtn'), onClick: ouvrir, disabled: occupe } });
  }

  // « Agir pour » (console admin) : l'équipe voit la liste, mais ne signe ni ne valide rien à la place du commerce.
  if (lectureSeule) etapes.forEach((e) => { delete e.action; });
  const restantes = etapes.filter((e) => !e.fait);
  if (!restantes.length) return null;
  const prochaine = restantes.find((e) => e.action);
  const faites = etapes.length - restantes.length;

  // `alerte` : l'étape à montrer en tête quand il n'y a pas de prochaine action (le retrait du site, shop-13), à la place
  // de « rien à faire de ton côté ».
  const alerte = retrait && !restaurant.publicListed ? etapes.find((e) => e.cle === 'enLigne') : null;
  return { etapes, restantes, prochaine, faites, alerte };
}
