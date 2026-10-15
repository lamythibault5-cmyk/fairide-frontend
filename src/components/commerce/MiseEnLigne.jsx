import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dateOuverturePaiements, paiementsOuverts } from '../../launch';
import LigneCompte from '../LigneCompte';

/* « AVANT D'ÊTRE EN LIGNE » : UNE SEULE LISTE, UN SEUL PROCHAIN BOUTON (audit UX du 15/10/2026).
 *
 * Ce qui restait à faire avant d'être vu des clients était éparpillé en quatre endroits : la carte d'état en tête du
 * tableau de bord (validation, visibilité, Stripe), le bandeau « Ta carte attend ta validation » (CarteAValider), la
 * liste de MenuReadiness sur la page Ma carte, et « Ma carte et mes engagements » (ConformiteCarte). La même carte se
 * validait de trois façons, et la liste de Ma carte se disait « prête » sans la signature ni la validation de l'équipe.
 * Un restaurateur testeur ne savait plus ce qui restait. Ici, dans l'ordre où ça se passe :
 *
 *   1. la carte existe (sinon : l'envoyer à Fairide ; ou Fairide la prépare, on attend) ;
 *   2. la carte est validée par le commerce (« C'est bon » : la signature vaut confirmation, carteSignee.signer) ;
 *   3. contrat, procédure allergènes et déclaration professionnelle signés (bloquent l'approbation, admin.js) ;
 *   4. les paiements Stripe, seulement si le commerce encaisse en ligne (formules.paiementsRequis côté serveur) ;
 *   5. la vérification par l'équipe (adminStatus) — rien à faire pour le commerce, on dit ce qui est vérifié ;
 *   6. la mise en ligne par l'équipe (publicListed).
 *
 * UN SEUL bouton plein : la première étape qui dépend du commerce. Les autres étapes à faire gardent un bouton discret,
 * les étapes de Fairide n'en ont pas (« on te prévient par e-mail »). `compact` (les autres pages du tableau de bord) :
 * une rangée « Prochaine étape », et rien du tout s'il ne reste que des étapes de Fairide.
 * La liste disparaît quand tout est fait. Un commerce de démonstration n'en a pas. */
export default function MiseEnLigne({ restaurant, restoId, token, onConnect, connecting, onChange, compact = false, lectureSeule = false }) {
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const [conformite, setConformite] = useState(null);
  const [demandeCarte, setDemandeCarte] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const o = restaurant?.onboarding;
  const nbPlats = (restaurant?.menu || []).length;

  // Les engagements (allergènes, déclaration pro) ne sont pas dans la fiche : même route que ConformiteCarte. Relue à
  // chaque rechargement de la fiche (un prix changé remet la carte à signer, une signature la complète).
  useEffect(() => {
    if (!restoId || restaurant?.isDemo) return;
    api(`/restaurants/${restoId}/compliance`, { token }).then(setConformite).catch(() => setConformite(null));
  }, [restoId, token, restaurant]); // eslint-disable-line react-hooks/exhaustive-deps
  // Carte vide : une demande « Fairide s'en occupe » déjà envoyée change l'étape 1 d'« à faire » en « on attend ».
  useEffect(() => {
    if (!restoId || nbPlats > 0) return;
    api(`/restaurants/${restoId}/menu/concierge`, { token }).then((r) => setDemandeCarte(r.request || null)).catch(() => setDemandeCarte(null));
  }, [restoId, token, nbPlats]);

  if (!restaurant || !o || restaurant.isDemo || restaurant.adminStatus === 'blocked') return null;

  async function validerCarte() {
    setOccupe(true);
    try {
      if (restaurant.menuSigned) {
        // Carte signée avant le correctif du 15/10 mais jamais confirmée : la confirmation seule suffit.
        await api(`/restaurants/${restoId}/menu/confirm`, { method: 'POST', token, body: {} });
        await onChange?.();
        toast(t('menuPage.handoverConfirmed'), 'succes');
      } else {
        // La page « C'est bon », la même que celle envoyée par SMS : une seule page de validation, quel que soit le chemin.
        const l = await api(`/restaurants/${restoId}/menu-validation-link`, { method: 'POST', token });
        navigate(`/carte/valider/${l.token}`);
      }
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  const engagementsOk = !!o.contractAccepted && (!conformite || (
    !!conformite.allergens?.attestation?.attestedAt && !!conformite.professional?.declaredAt && conformite.professional?.upToDate !== false));
  const stripeRestreint = restaurant.stripeConnectStatus === 'restricted';

  // `action` : ce que le commerce peut faire maintenant ({ libelle, to } ou { libelle, onClick }) ; `attente` : étape de
  // Fairide, sans bouton. Une étape faite n'a ni l'un ni l'autre.
  const etapes = [];
  etapes.push(nbPlats > 0
    ? { cle: 'carte', fait: true, icone: 'carte', titre: t('miseEnLigne.menuDone', { n: nbPlats }) }
    : demandeCarte
      ? { cle: 'carte', attente: true, icone: 'horloge', titre: t('miseEnLigne.menuPreparing'), sous: t('miseEnLigne.menuPreparingSub') }
      : { cle: 'carte', icone: 'carte', titre: t('miseEnLigne.menuSend'), sous: t('miseEnLigne.menuSendSub'), action: { libelle: t('miseEnLigne.menuSendBtn'), to: '/dashboard/menu' } });
  // Un commerce vitrine ne vend pas : rien à signer (même règle que l'ancien bandeau CarteAValider).
  if (!restaurant.vitrine && nbPlats > 0) {
    const carteValidee = restaurant.menuSigned && !o.menuPending;
    etapes.push(carteValidee
      ? { cle: 'valider', fait: true, icone: 'valider', titre: t('miseEnLigne.validateDone') }
      : { cle: 'valider', icone: 'valider', titre: t('miseEnLigne.validate'), sous: t('miseEnLigne.validateSub'),
          action: { libelle: occupe ? '…' : t('miseEnLigne.validateBtn'), onClick: validerCarte, disabled: occupe } });
  }
  etapes.push(engagementsOk
    ? { cle: 'engagements', fait: true, icone: 'contrat', titre: t('miseEnLigne.commitmentsDone') }
    : { cle: 'engagements', icone: 'contrat', titre: t('miseEnLigne.commitments'), sous: t('miseEnLigne.commitmentsSub'),
        action: { libelle: t('miseEnLigne.commitmentsBtn'), to: o.contractAccepted ? '/dashboard/menu#conformite-carte' : '/account?ouvrir=contrat&retour=/dashboard' } });
  // À emporter payé sur place seulement : rien ne transite par Fairide, pas d'étape paiements (formules.paiementsRequis).
  if (o.paymentsRequired !== false) {
    const actif = restaurant.stripeConnectStatus === 'active';
    etapes.push(actif
      ? { cle: 'paiements', fait: true, icone: 'carteBancaire', titre: t('miseEnLigne.paymentsDone') }
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
  etapes.push(restaurant.publicListed
    ? { cle: 'enLigne', fait: true, icone: 'globe', titre: t('miseEnLigne.listedDone') }
    : { cle: 'enLigne', attente: true, icone: 'globe', titre: t('miseEnLigne.listed'), sous: t('miseEnLigne.listedSub') });

  // « Agir pour » (console admin) : l'équipe voit la liste, mais ne signe ni ne valide rien à la place du commerce.
  if (lectureSeule) etapes.forEach((e) => { delete e.action; });
  const restantes = etapes.filter((e) => !e.fait);
  if (!restantes.length) return null;
  const prochaine = restantes.find((e) => e.action);
  const faites = etapes.length - restantes.length;

  const bouton = (e, principal) => {
    const classe = `${principal ? 'btn-gold' : 'btn-outline'} btn-sm`;
    if (e.action.to) return <Link to={e.action.to} className={classe} style={{ display: 'inline-block' }}>{e.action.libelle}</Link>;
    return <button type="button" className={classe} onClick={e.action.onClick} disabled={e.action.disabled}>{e.action.libelle}</button>;
  };

  if (compact) {
    if (!prochaine) return null;
    return (
      <div className="card account-groupe" aria-label={t('miseEnLigne.title')}>
        <LigneCompte icone={prochaine.icone} accent="warn" titre={t('miseEnLigne.nextStep', { step: prochaine.titre })}
          sous={t('miseEnLigne.remaining', { n: restantes.length })} action={bouton(prochaine, true)} />
      </div>
    );
  }

  return (
    <section className="card account-groupe mise-en-ligne" aria-labelledby="mise-en-ligne-titre">
      <div style={{ padding: '14px 16px 6px' }}>
        <h3 id="mise-en-ligne-titre" style={{ margin: 0, fontSize: 16 }}>{t('miseEnLigne.title')}</h3>
        <p className="small" style={{ margin: '4px 0 0' }}>
          {t('miseEnLigne.progress', { done: faites, total: etapes.length })}
          {' · '}{prochaine ? t('miseEnLigne.nextStep', { step: prochaine.titre }) : t('miseEnLigne.nothingForYou')}
        </p>
      </div>
      {etapes.map((e) => (
        <LigneCompte key={e.cle} icone={e.fait ? 'valider' : e.icone} accent={e.fait ? 'ok' : e.attente ? undefined : 'warn'}
          titre={e.titre} sous={e.sous}
          action={e.action ? bouton(e, e === prochaine) : <span className="small">{t(e.fait ? 'miseEnLigne.done' : e.attente ? 'miseEnLigne.waiting' : 'miseEnLigne.toDo')}</span>} />
      ))}
    </section>
  );
}
