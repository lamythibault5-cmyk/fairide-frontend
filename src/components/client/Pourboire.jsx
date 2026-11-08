/* LE POURBOIRE EN UN GESTE, À LA LIVRAISON (fondateur, 2026-11-06 ; maquettes/pourboire/pourboire.html, toutes les
 * recommandations, sans pourboire au paiement).
 *
 * Avant : « Laisser un pourboire » caché sous « Détails », un formulaire gris, puis une seconde page Stripe où remettre son
 * moyen de paiement — sept gestes, presque personne n'allait au bout. Maintenant deux gestes, sans quitter l'appli :
 * le montant (1, 2, 5 € ou « Autre » ; 5 au lieu de 3 le 2026-11-08, Owen, 2 € choisi d'office pour que le bouton dise ce qu'il fait), puis « Donner 2 € ».
 *   - FeuillePourboire : la feuille qui s'ouvre une fois à l'arrivée (notification « Karim t'a livré », ou la commande qui
 *     passe à « Livrée » sous les yeux), version A de la maquette ;
 *   - ChoixPourboire variante « ligne » : la même chose sur la carte de la commande dans Mes commandes, pendant les sept
 *     jours où le pourboire reste possible (version B), pour celui qui a fermé la feuille.
 * Le serveur (POST /api/payments/tip/:id, backend pourboireApres.js) débite la carte que Stripe a gardée au paiement de la
 * commande. Payé avec Bancontact, commande d'avant ce changement, carte retirée ou banque qui veut une confirmation : il
 * renvoie la page Stripe d'aujourd'hui, montant déjà rempli, ouverte par allerAuPaiement (jamais window.location, règle de
 * l'app). Le livreur reçoit tout : la phrase le dit (question 9 de la maquette, exception notée dans docs/agents/voix.md).
 * Un pourboire touché par erreur ne débite rien : il faut toucher « Donner » (question 2). */
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { allerAuPaiement } from '../../natif';
import { vibrer } from '../../gestes';
import { euros, eurosCourt } from '../../prixPlat';
import { getLocale } from '../../context/LanguageContext';
import ChoixPastilles from '../ChoixPastilles';
import Modale from '../Modale';
import Icone from '../Icone';
import './pourboire.css';

const prenom = (nom) => String(nom || '').trim().split(/\s+/)[0] || '';
const initiales = (nom) => String(nom || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('');
const MONTANTS = [1, 2, 5];

// « Visa •••• 4242 · la carte de ta commande », « Apple Pay · comme ta commande », « Bancontact · comme ta commande ».
function libelleMoyen(moyen, t) {
  if (!moyen) return null;
  if (moyen.type === 'carte') {
    if (moyen.wallet === 'apple_pay' || moyen.wallet === 'google_pay') return t(`pourboire.wallet_${moyen.wallet}`);
    const marque = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro' }[moyen.brand] || String(moyen.brand || '').toUpperCase();
    return t('pourboire.carte', { brand: marque, last4: moyen.last4 });
  }
  if (moyen.type === 'bancontact') return t('pourboire.bancontact');
  if (moyen.type === 'page') return t('pourboire.page');
  return null;
}

/* LE CHOIX ET LE GESTE. `onPaye(maj)` : le pourboire est payé (maj = { tipPaid, tipAmount }) ; la carte de la commande se met
 * à jour sans attendre la relecture. `variante` : « feuille » (dans FeuillePourboire) ou « ligne » (sur la carte). */
export function ChoixPourboire({ order, token, toast, t, onPaye, variante = 'feuille' }) {
  const [apercu, setApercu] = useState(null);
  const [choix, setChoix] = useState('2');
  const [autre, setAutre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [merci, setMerci] = useState(null);
  useEffect(() => {
    let actif = true;
    api(`/payments/tip/${order.id}`, { token }).then((a) => { if (actif) setApercu(a); }).catch(() => {});
    return () => { actif = false; };
  }, [order.id, token]);

  const nom = prenom(order.driverName);
  const montants = Array.isArray(apercu?.montants) && apercu.montants.length ? apercu.montants : MONTANTS;
  const minimum = apercu?.minimum ?? 1;
  const maximum = apercu?.maximum ?? Math.max(50, Number(order.total || 0) * 2);
  // « 2,50 » est lu comme 2,50 € (audit du 19/10, CROSS-62).
  const montant = choix === 'autre' ? +(Number(String(autre).replace(',', '.')) || 0).toFixed(2) : Number(choix);
  const bancontact = apercu?.moyen?.type === 'bancontact';

  async function donner() {
    if (envoi) return;
    if (!(montant >= minimum)) { toast(t('pourboire.minimum'), 'erreur'); return; }
    if (montant > maximum) { toast(t('pourboire.plafond', { max: euros(maximum) }), 'erreur'); return; }
    setEnvoi(true);
    try {
      const r = await api(`/payments/tip/${order.id}`, { method: 'POST', token, body: { tip: montant } });
      if (r.statut === 'paye' || r.statut === 'simule') {
        const paye = Number(r.montant ?? montant);
        vibrer('succes');
        setMerci(paye);
        onPaye?.({ tipPaid: true, tipAmount: paye });
        return;
      }
      if (r.statut === 'page' && r.checkoutUrl) {
        if (r.raison === 'confirmation' || r.raison === 'refusee') toast(t(`pourboire.raison_${r.raison}`));
        await allerAuPaiement(r.checkoutUrl, { retour: '/orders' });
        return;
      }
      // Stripe n'a pas encore tranché : le serveur finit tout seul (rattrapage de chaque minute), la relecture le montrera.
      toast(t('pourboire.enCours'));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  if (merci !== null) {
    return (
      <div className={`pb-merci pb-${variante}`} role="status">
        <span className="pb-merci-rond" aria-hidden="true"><Icone nom="valider" taille={26} /></span>
        <b>{t('pourboire.merciTitre')}</b>
        <span>{t('pourboire.merci', { name: nom, amount: euros(merci) })}</span>
      </div>
    );
  }
  return (
    <div className={`pb-choix pb-${variante}`}>
      {variante === 'ligne' && <div className="pb-question">{t('pourboire.question', { name: nom })}</div>}
      <ChoixPastilles
        libelle={t('pourboire.question', { name: nom })}
        valeur={choix}
        onChange={setChoix}
        options={[...montants.map((m) => ({ value: String(m), label: eurosCourt(m) })), { value: 'autre', label: t('pourboire.autre') }]}
      />
      {/* Texte + clavier décimal plutôt que type="number" (audit du 19/10, CROSS-62). */}
      {choix === 'autre' && (
        <input className="pb-autre" aria-label={t('pourboire.autrePh')} type="text" inputMode="decimal" autoComplete="off"
          placeholder={t('pourboire.autrePh')} value={autre} onChange={(e) => setAutre(e.target.value)} autoFocus />
      )}
      {libelleMoyen(apercu?.moyen, t) && <div className="pb-moyen small">{libelleMoyen(apercu.moyen, t)}</div>}
      <button type="button" className="btn-gold pb-donner" onClick={donner} aria-busy={envoi || undefined}>
        {envoi ? '…' : t(bancontact ? 'pourboire.donnerBancontact' : 'pourboire.donner', { amount: euros(montant > 0 ? montant : 0) })}
      </button>
      <p className="small pb-tout">{t('pourboire.recoitTout', { name: nom })}</p>
    </div>
  );
}

/* LA FEUILLE À L'ARRIVÉE. Une feuille du bas sur téléphone (Modale : tirée vers le bas pour fermer dans l'app), centrée sur
 * ordinateur. « Pas cette fois » la ferme : la ligne reste sur la carte de la commande. */
export function FeuillePourboire({ order, token, toast, t, onFermer, onPaye }) {
  const nom = prenom(order.driverName);
  const heure = order.deliveredAt ? new Date(order.deliveredAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
  const [paye, setPaye] = useState(false);
  // Payé : le merci reste un instant, puis la feuille se ferme d'elle-même.
  useEffect(() => {
    if (!paye) return undefined;
    const id = setTimeout(onFermer, 1900);
    return () => clearTimeout(id);
  }, [paye]); // eslint-disable-line react-hooks/exhaustive-deps -- seulement quand le pourboire vient d'être payé
  return (
    <Modale onFermer={onFermer} ariaLabel={t('pourboire.titre', { name: nom })} classeBoite="pb-boite">
      <div className="pb-qui">
        <span className="pb-av" aria-hidden="true">{initiales(order.driverName)}</span>
        <span className="pb-qui-texte">
          <b>{t('pourboire.titre', { name: nom })}</b>
          <span className="small">{t('pourboire.commande', { restaurant: order.restaurantName, heure }).replace(/ · $/, '')}</span>
        </span>
      </div>
      {!paye && <div className="pb-question">{t('pourboire.question', { name: nom })}</div>}
      <ChoixPourboire order={order} token={token} toast={toast} t={t} variante="feuille"
        onPaye={(maj) => { setPaye(true); onPaye?.(maj); }} />
      {!paye && <button type="button" className="pb-pas" onClick={onFermer}>{t('pourboire.pasCetteFois')}</button>}
    </Modale>
  );
}
