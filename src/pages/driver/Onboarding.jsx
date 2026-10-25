import DossierAppli, { FinExpress } from './DossierAppli';
import DossierSuivi from './DossierSuivi';
import useRevalidation from '../../useRevalidation';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import ErreurChargement from '../../components/ErreurChargement';
// Le bandeau et la feuille du livreur sur un ordinateur (largeur de lecture, coins de la feuille) : ce fichier n'est chargé
// qu'avec les pages du livreur, et ses règles sont réservées au site (html:not(.appli)).
import '../../site-livreur.css';

/* /driver/onboarding, LE DOSSIER DU LIVREUR — UN SEUL, SUR LE SITE COMME DANS L'APP (fondateur, 2026-10-25).
 * Jusque-là, le site avait son dossier en six étapes (statut, identité, infos, engagements, paiements, envoi) et l'app le sien
 * (sommaire et un écran par sujet, inscription express du 2026-10-22). Les deux lisaient et enregistraient le même dossier,
 * mais le livreur qui passait de l'un à l'autre ne s'y retrouvait pas, et chaque correction (un texte, une pièce, une règle)
 * se faisait deux fois. Il ne reste que celui de l'app, élargi sur un ordinateur (DossierAppli.jsx) :
 *   - brouillon ou refusé : DossierAppli (sommaire, puis un écran par sujet ; sur le site large, les deux côte à côte) ;
 *   - le dossier vient de partir : FinExpress (« Tu peux rouler » ou « Presque prêt »), une fois ;
 *   - envoyé, validé, suspendu : DossierSuivi (compteurs, ses courses, son minimum, ses pièces, changer de statut…).
 * Ce fichier ne garde que le chargement du dossier et les retours de Stripe (identité, compte de versement).
 * Rien ici n'impose d'horaire, de quota de courses ni de taux d'acceptation : le livreur choisit ses courses. Aucun montant
 * légal n'est écrit dans ces fichiers : tout vient de `legal` (configuration fiscale). */
export default function Onboarding() {
  const { t } = useLanguage();
  const { token, user, refreshUser } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [d, setD] = useState(null);
  const [etape, setEtape] = useState(null);
  const [busy, setBusy] = useState(false);
  // Un premier chargement raté ne laisse plus le squelette pour toujours : « Impossible de charger » + Réessayer (audit du 19/10, CROSS-33).
  const [erreurChargement, setErreurChargement] = useState(null);

  const charger = async () => { const r = await api('/couriers/me', { token }); setD(r); setErreurChargement(null); return r; };
  /* RETOUR DE STRIPE DANS L'APPLICATION (audit du 19/10, courier-3). Le navigateur intégré qui se ferme ramène à la MÊME
   * adresse (natif.js : browserFinished, lien universel) : la page n'est pas remontée, et la relecture, faite une seule fois
   * à l'ouverture, ne repassait pas. Le dossier restait sur « Identité à faire » et « Reprendre la vérification » ; toucher
   * ce bouton relançait une session qui remettait l'identité « en attente » (le serveur le refuse désormais). On relit donc
   * à chaque arrivée sur cette adresse (location.key change à chaque navigation), et au retour de l'application au premier
   * plan (useRevalidation) ; une vérification Stripe Identity encore en attente est relue chez Stripe, comme le compte de
   * paiement « en attente » plus bas. `relu` : nos propres nettoyages de l'adresse, qui n'ont pas à relancer tout ça. */
  const location = useLocation();
  async function relireDossier(retourIdentite = false) {
    let r = await charger();
    const id = r?.courier?.identity;
    if (retourIdentite || (id?.provider === 'stripe_identity' && ['pending', 'processing'].includes(id?.status))) {
      const relu = await api('/couriers/me/identity/refresh', { method: 'POST', token }).catch((e) => { if (retourIdentite) throw e; return null; });
      if (relu) { r = relu; setD(relu); }
    }
    return r;
  }
  useRevalidation(async () => {
    const r = await relireDossier();
    if ((r?.user?.stripeConnectStatus || user?.stripeConnectStatus) === 'pending') {
      await api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {});
      await refreshUser?.().catch(() => {});
      await charger();
    }
  });
  useEffect(() => {
    if (location.state?.relu) return;
    (async () => {
      try {
        let r = await relireDossier(params.get('identity') === 'retour');
        // Sur le site, Stripe est une autre page : on en revient sur l'écran de la pièce d'identité, comme dans l'app, où le
        // navigateur intégré se referme sur lui (DossierAppli suit l'écran demandé).
        if (params.get('identity')) setEtape('identite');
        if (params.get('identity') === 'retour') { params.delete('identity'); setParams(params, { replace: true, state: { relu: true } }); }
        if (params.get('identity') === 'ok') { toast(t('courierOnboarding.identityOk'), 'succes'); params.delete('identity'); setParams(params, { replace: true, state: { relu: true } }); }
        if (params.get('identity') === 'erreur') { toast(t('courierOnboarding.identityFailed'), 'erreur'); params.delete('identity'); setParams(params, { replace: true, state: { relu: true } }); }
        // Retour de Stripe lancé depuis le dossier (écran des paiements) : on relit le statut du compte de paiement et on
        // rouvre cet écran, au lieu de laisser le livreur chercher où il en était.
        if (params.get('connect') !== 'return' && (r?.user?.stripeConnectStatus || user?.stripeConnectStatus) === 'pending') {
          // Filet : compte Stripe resté « en attente » (onglet fermé avant le retour, activation un peu après) — relu ici aussi.
          await api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {});
          await refreshUser?.().catch(() => {});
          r = await charger();
        }
        if (params.get('connect') === 'return') {
          await api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {});
          await refreshUser?.().catch(() => {});
          r = await charger();
          params.delete('connect'); setParams(params, { replace: true, state: { relu: true } });
          setEtape('envoi');
        }
      } catch (e) { toast(e.message, 'erreur'); setErreurChargement(e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  // FIN DE L'INSCRIPTION EXPRESS (2026-10-22) : le dossier, brouillon à l'écran, vient de partir (le serveur l'envoie seul dès
  // qu'il est complet, et le valide si tout est vert). On le montre une fois, au moment où ça arrive, avant le suivi du dossier.
  const navigate = useNavigate();
  const [finExpress, setFinExpress] = useState(false);
  const cycleAvant = useRef(null);
  useEffect(() => {
    const cycle = d?.courier?.lifecycleStatus;
    if (['draft', 'rejected'].includes(cycleAvant.current) && ['pending_review', 'approved'].includes(cycle)) setFinExpress(true);
    if (cycle) cycleAvant.current = cycle;
  }, [d?.courier?.lifecycleStatus]);

  // RETOUR DE STRIPE DANS L'APP (2026-10-21, vérification Stripe site / app). L'effet ci-dessus ne tourne qu'à l'ouverture :
  // dans l'app, le dossier reste ouvert pendant la vérification d'identité ou Stripe Connect (par-dessus), et le livreur
  // revoyait « Commencer » au retour — de quoi lancer une seconde vérification. Chaque retour au premier plan relit donc
  // l'identité (sans effet si elle n'est pas en cours chez Stripe) et, s'il est en attente, le compte de paiement.
  // Le formulaire du dossier garde ce qui est tapé (DossierAppli lit `d` une seule fois).
  useRevalidation(async () => {
    const r = await api('/couriers/me/identity/refresh', { method: 'POST', token });
    if (r?.courier) setD(r);
    if ((r?.user?.stripeConnectStatus || user?.stripeConnectStatus) === 'pending') {
      await api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {});
      await refreshUser?.().catch(() => {});
      await charger();
    }
  }, { actif: !!d, absenceMin: 0 });

  async function action(fn, ok) {
    setBusy(true);
    // Enregistré, mais la relecture du dossier échoue : ce n'est pas un échec de l'enregistrement. Le dire comme tel poussait
    // le livreur à renvoyer ses pièces (audit du 19/10, CROSS-49) ; la relecture se refait au prochain retour sur la page.
    try {
      const r = await fn();
      if (r && r.courier) setD(r); else await charger().catch(() => {});
      if (ok) toast(ok);
      return true;
    } catch (e) { toast(e.message, 'erreur'); return false; } finally { setBusy(false); }
  }

  if (!d && erreurChargement) return <ErreurChargement erreur={erreurChargement} onReessayer={() => { setErreurChargement(null); charger().catch(setErreurChargement); }} />;
  if (!d) return <SkeletonCards count={3} />;
  const c = d.courier;
  // Le dossier vient de partir (le serveur l'envoie seul, et le valide si tout est vert) : la fin de l'inscription express.
  if (finExpress && ['pending_review', 'approved'].includes(c.lifecycleStatus)) {
    return <FinExpress d={d} t={t} onCourses={() => { setFinExpress(false); navigate('/driver'); }} onDossier={() => setFinExpress(false)} />;
  }
  if (c.lifecycleStatus === 'draft' || c.lifecycleStatus === 'rejected') {
    return <DossierAppli d={d} charger={charger} token={token} user={user} busy={busy} action={action} refreshUser={refreshUser} etapeDemandee={etape} />;
  }
  /* ENVOYÉ, VALIDÉ, SUSPENDU : bandeau et feuille (deuxième audit design, section 9, approuvé le 2026-10-19), sur le site aussi
   * depuis le 2026-10-25. La page du site empilait des cartes (état, compteurs, formulaires ouverts) ; mêmes blocs et mêmes
   * routes ici (dossierBlocs.jsx), chacun dans sa feuille. */
  return <DossierSuivi d={d} token={token} user={user} busy={busy} action={action} charger={charger}
    onStatutChange={() => { setEtape('statut'); refreshUser?.(); }} />;
}
