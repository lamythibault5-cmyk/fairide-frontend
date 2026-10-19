import { useEffect, useState, useId } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import SousEcran from '../../components/SousEcran';
import { experienceApp } from '../../natif';

const APPLI = experienceApp();
import { api } from '../../api';
import GiftVouchers from '../../components/GiftVouchers';
import MiseEnAvant from '../../components/MiseEnAvant';
import CadreSite from '../../components/commerce/CadreSite';
import { SegmentGlisse } from '../../components/commerce/BandeauCommerce';
import LigneGlissante from '../../components/commerce/LigneGlissante';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../../components/Icone';
import EtatVide from '../../components/EtatVide';

/* PROMOTIONS — BANDEAU IRIS ET FEUILLE BLANCHE, DANS L'APP COMME SUR LE SITE (fondateur, 2026-10-19, « Proposal » de la
 * section 4 de finitions-appli.html). Sur le bandeau, le titre et le compte (« 1 active · 1 en pause ») ; dans la feuille,
 * les promotions en rangées à filet (tuile d'icône, titre, « Sur un plat · active ») avec un interrupteur iris à la place
 * de « Activer / Désactiver ». Supprimer : un glissement vers la gauche dans l'app native, un petit × sur le site
 * (LigneGlissante.jsx), puis la même ConfirmDialog — avant, le bouton supprimait sans rien demander. Mêmes appels au
 * serveur, mêmes champs de création, mêmes contrôles qu'avant ; les styles sont dans ecran-commerce.css (bloc « Promotions,
 * Avis, Factures »). */

const TYPES = [
  { value: 'percent', label: 'typePercent' },
  { value: 'bogo', label: 'typeBuyN' },
  { value: 'cart_threshold', label: 'typeCart' }
];
// La tuile de chaque rangée : l'étiquette pour un pourcentage, le cadeau pour « N achetés = 1 offert », le sac pour une
// offre sur toute la commande.
const ICONES = { percent: 'etiquette', bogo: 'cadeau', cart_threshold: 'sac' };

// « Avantage Fairide » : le commerce garde 90 % du prix (contre ~70 % sur les grandes plateformes). S'il le
// souhaite — et seulement s'il le souhaite — il en fait profiter ses clients : -X € (ou -X %) sur chaque produit,
// ou -X € sur chaque livraison. Le ton reste une proposition, jamais une obligation.
const MONTANTS_PRODUIT = [0.5, 1, 1.5, 2, 3];
const POURCENTS_PRODUIT = [5, 10, 15];
const MONTANTS_LIVRAISON = [1, 1.5, 2, 3];
const eur = (v) => `${Number(v).toFixed(2).replace('.', ',').replace(/,00$/, '')} €`;

/* Les deux options deviennent des rangées à interrupteur (2026-10-19). Allumer n'enregistre rien encore : il faut un
 * montant, donc l'interrupteur ouvre le choix sous la rangée (euros ou pourcentage, puis le montant) et c'est le montant
 * touché qui enregistre, comme les boutons d'avant. Éteindre retire l'avantage tout de suite (« Retirer » d'avant). Le
 * long texte d'explication passe derrière « En savoir plus » ; la phrase courte reste visible. */
function AvantageFairide({ restaurant, restoId, token, toast, t, loadDashboard, onChanged }) {
  const [busy, setBusy] = useState('');
  const [modeProduit, setModeProduit] = useState('amount');
  const [choix, setChoix] = useState(null); // 'produits' | 'livraison' : le choix du montant est ouvert
  const [details, setDetails] = useState(false);
  const avantage = restaurant?.fairideAdvantage || null;
  const livraisonOfferte = !!restaurant?.freeDelivery;
  const remiseLivraison = Number(restaurant?.deliveryFeeDiscount || 0);
  // Livraison offerte dès un minimum de commande (réglée dans Ma fiche → Offre livraison) : c'est aussi une offre active.
  const minimumOffert = restaurant?.freeDeliveryMinOrder != null ? Number(restaurant.freeDeliveryMinOrder) : null;
  const livraisonActive = livraisonOfferte || remiseLivraison > 0 || minimumOffert != null;

  async function reglerProduits(mode, value) {
    setBusy('produits');
    try {
      await api(`/restaurants/${restoId}/promotions/fairide`, { method: 'PUT', token, body: value === null ? { off: true } : { mode, value } });
      await loadDashboard(restoId); onChanged?.();
      setChoix(null);
      toast(value === null ? t('promosPage.fairideRemoved') : t('promosPage.fairideSaved'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(''); }
  }
  async function reglerLivraison(value) {
    setBusy('livraison');
    try {
      await api(`/restaurants/${restoId}/delivery-discount`, { method: 'PATCH', token, body: { freeDelivery: false, deliveryFeeDiscount: value, freeDeliveryMinOrder: null } });
      await loadDashboard(restoId);
      setChoix(null);
      toast(value === 0 ? t('promosPage.fairideRemoved') : t('promosPage.fairideSaved'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(''); }
  }

  const etatProduits = avantage
    ? (avantage.mode === 'amount' ? t('promosPage.fairideItemsActiveAmount', { v: eur(avantage.value) }) : t('promosPage.fairideItemsActivePercent', { v: avantage.value }))
    : t('promosPage.fairideItemsShort');
  const etatLivraison = livraisonActive
    ? (minimumOffert != null ? `${t('promosPage.fairideDeliveryFree')} · ${t('editResto.offerFromMin', { amount: minimumOffert })}` : livraisonOfferte ? t('promosPage.fairideDeliveryFree') : t('promosPage.fairideDeliveryActive', { v: eur(remiseLivraison) }))
    : t('promosPage.fairideDeliveryShort');

  // L'interrupteur : allumé si l'avantage est en place, ou pendant qu'on choisit son montant.
  const interrupteur = (cle, actif, titre) => (
    <button type="button" role="switch" aria-checked={actif} aria-expanded={!actif ? choix === cle : undefined}
      className={`ec-interrupteur${actif || choix === cle ? ' on' : ''}`} aria-label={titre} disabled={busy === cle}
      onClick={() => {
        if (actif) { if (cle === 'produits') reglerProduits(null, null); else reglerLivraison(0); }
        else setChoix(choix === cle ? null : cle);
      }} />
  );

  return (
    <section className="ec-avantage" aria-labelledby="avantage-titre">
      {/* Pas d'AvecMarque ici : le mot-logo est toujours en minuscules, et ce titre de section est en capitales. */}
      <p className="ec-feuille-titre" id="avantage-titre">{t('promosPage.fairideTitle')}</p>
      <p className="ec-aide">
        {t('promosPage.fairideShort')}{' '}
        <button type="button" className="ec-lien ec-lien--enligne" aria-expanded={details} onClick={() => setDetails((d) => !d)}>
          {details ? t('promosPage.learnLess') : t('promosPage.learnMore')}
        </button>
      </p>
      {details && (
        <div className="ec-aide ec-aide--details">
          <p>{t('promosPage.fairideIntro')}</p>
          <p>{t('promosPage.fairideOptional')} <Link to="/dashboard/menu#menu-geste-prix">{t('promosPage.fairidePricesLink')}</Link></p>
          <p>{t('promosPage.fairideItemsHelp')}</p>
          <p>{t('promosPage.fairideDeliveryHelp')}</p>
        </div>
      )}

      <div className="ec-ligne">
        <span className="ec-ligne-tuile" aria-hidden="true"><Icone nom="restaurants" taille={20} /></span>
        <span className="ec-ligne-texte"><b>{t('promosPage.fairideItemsTitle')}</b><small>{etatProduits}</small></span>
        {interrupteur('produits', !!avantage, t('promosPage.fairideItemsTitle'))}
      </div>
      {choix === 'produits' && !avantage && (
        <div className="ec-choix-montant">
          <SegmentGlisse libelle={t('promosPage.fairideItemsTitle')} valeur={modeProduit} onChange={setModeProduit}
            options={[{ value: 'amount', label: t('promosPage.fairideModeAmount') }, { value: 'percent', label: t('promosPage.fairideModePercent') }]} />
          <div className="ec-montants">
            {(modeProduit === 'amount' ? MONTANTS_PRODUIT : POURCENTS_PRODUIT).map((v) => (
              <button key={v} type="button" className="ec-puce" disabled={busy === 'produits'} onClick={() => reglerProduits(modeProduit, v)}>
                −{modeProduit === 'amount' ? eur(v) : `${v} %`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ec-ligne">
        <span className="ec-ligne-tuile" aria-hidden="true"><Icone nom="velo" taille={20} /></span>
        <span className="ec-ligne-texte"><b>{t('promosPage.fairideDeliveryTitle')}</b><small>{etatLivraison}</small></span>
        {interrupteur('livraison', livraisonActive, t('promosPage.fairideDeliveryTitle'))}
      </div>
      {choix === 'livraison' && !livraisonActive && (
        <div className="ec-choix-montant">
          <div className="ec-montants">
            {MONTANTS_LIVRAISON.map((v) => (
              <button key={v} type="button" className="ec-puce" disabled={busy === 'livraison'} onClick={() => reglerLivraison(v)}>−{eur(v)}</button>
            ))}
          </div>
        </div>
      )}
      <p className="ec-aide" style={{ marginTop: 8 }}>{t('promosPage.fairideDeliveryMore')}</p>
    </section>
  );
}

export default function PromotionsPage() {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, restoId, loadDashboard } = useOutletContext();

  const [promos, setPromos] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState('percent');
  const [itemId, setItemId] = useState('');
  const [percentValue, setPercentValue] = useState('15');
  const [bogoN, setBogoN] = useState('1');
  const [discountValue, setDiscountValue] = useState('');
  const [minCartTotal, setMinCartTotal] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);

  function loadPromos() {
    api(`/restaurants/${restoId}/promotions/mine`, { token }).then(setPromos).catch((e) => toast(e.message, 'erreur'));
  }

  useEffect(() => {
    loadPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  async function createPromo() {
    setSaving(true);
    try {
      if (type === 'cart_threshold') {
        const x = Number(discountValue);
        const y = Number(minCartTotal);
        if (!x || x <= 0) { toast(t('promosPage.toastAmount')); setSaving(false); return; }
        if (!y || y <= x) { toast(t('promosPage.toastThreshold')); setSaving(false); return; }
        await api(`/restaurants/${restoId}/promotions`, { method: 'POST', token, body: { discountValue: x, minCartTotal: y } });
      } else {
        if (!itemId) { toast(t('promosPage.toastChooseDish'), 'erreur'); setSaving(false); return; }
        const body = type === 'percent' ? { type: 'percent', value: Number(percentValue) } : { type: 'bogo', value: Number(bogoN) };
        await api(`/restaurants/${restoId}/menu/${itemId}/promotions`, { method: 'POST', token, body });
      }
      setFormOpen(false);
      setItemId(''); setDiscountValue(''); setMinCartTotal('');
      loadPromos();
      toast(t('promosPage.toastCreated'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo) {
    setTogglingId(promo.id);
    try {
      await api(`/promotions/${promo.id}`, { method: 'PATCH', token, body: { active: !promo.active } });
      loadPromos();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setTogglingId(null);
    }
  }

  async function deletePromo(promo) {
    setDeletingId(promo.id);
    try {
      await api(`/promotions/${promo.id}`, { method: 'DELETE', token });
      loadPromos();
      toast(t('promosPage.toastDeleted'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setDeletingId(null);
      setASupprimer(null);
    }
  }

  // Les promotions « all_items » sont l'Avantage Fairide sur chaque produit : elles ont leur propre rangée plus bas.
  const propres = promos === null ? null : promos.filter((p) => !String(p.type).startsWith('all_items'));
  const actives = (propres || []).filter((p) => p.active).length;
  const enPause = (propres || []).length - actives;
  const compte = propres === null ? null : propres.length === 0 ? t('promosPage.none')
    : [actives > 0 && t(actives > 1 ? 'promosPage.countActive_other' : 'promosPage.countActive_one', { n: actives }),
      enPause > 0 && t('promosPage.countPaused', { n: enPause })].filter(Boolean).join(' · ');
  const titrePromo = (p) => (p.itemName ? `${p.label} · ${p.itemName}` : p.label);

  // Les champs d'une nouvelle promotion : dans la feuille sur le site, dans une feuille par-dessus dans l'app.
  const champsPromo = (
    <>
        <div className="field">
          <label htmlFor={idsA11y + '-type'}>{t('promosPage.type')}</label>
          <select id={idsA11y + '-type'} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((tp) => <option key={tp.value} value={tp.value}>{t(`promosPage.${tp.label}`)}</option>)}
          </select>
        </div>

        {type !== 'cart_threshold' && (
          <div className="field">
            <label htmlFor={idsA11y + '-dish'}>{t('promosPage.dish')}</label>
            <select id={idsA11y + '-dish'} value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">{t('promosPage.chooseDish')}</option>
              {(restaurant.menu || []).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select>
          </div>
        )}

        {type === 'percent' && (
          <div className="field">
            <label htmlFor={idsA11y + '-discount'}>{t('promosPage.discount')}</label>
            <select id={idsA11y + '-discount'} value={percentValue} onChange={(e) => setPercentValue(e.target.value)}>
              {[10, 15, 20, 25, 30, 40, 50].map((v) => <option key={v} value={v}>{v}%</option>)}
            </select>
          </div>
        )}

        {type === 'bogo' && (
          <div className="field">
            <label htmlFor={idsA11y + '-buyn'}>{t('promosPage.buyN')}</label>
            <select id={idsA11y + '-buyn'} value={bogoN} onChange={(e) => setBogoN(e.target.value)}>
              {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{t('promosPage.bogoOption', { n: v })}</option>)}
            </select>
          </div>
        )}

        {type === 'cart_threshold' && (
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor={idsA11y + '-amountoff'}>{t('promosPage.amountOff')}</label>
              <input id={idsA11y + '-amountoff'} type="number" step="0.5" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="5" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor={idsA11y + '-threshold'}>{t('promosPage.threshold')}</label>
              <input id={idsA11y + '-threshold'} type="number" step="0.5" value={minCartTotal} onChange={(e) => setMinCartTotal(e.target.value)} placeholder="30" />
            </div>
          </div>
        )}

    </>
  );

  return (
    <CadreSite appli lecture classe="ec-promos" titre={t('promosPage.title')} sous={compte ?? '…'}>
      <p className="ec-feuille-titre">{t('promosPage.ownPromosTitle')}</p>
      {propres === null && <p className="ec-aide">{t('promosPage.loading')}</p>}
      {propres !== null && propres.length === 0 && !formOpen && <EtatVide icone="etiquette" titre={t('promosPage.none')} />}
      {propres !== null && propres.length > 0 && (
        <div className="ec-lignes">
          {propres.map((p) => (
            <LigneGlissante key={p.id} libelle={t('promosPage.deletePromo')} disabled={deletingId === p.id} onSupprimer={() => setASupprimer(p)}
              className={p.active ? '' : 'ec-ligne--pause'}>
              <span className="ec-ligne-tuile" aria-hidden="true"><Icone nom={ICONES[p.type] || 'etiquette'} taille={20} /></span>
              <span className="ec-ligne-texte">
                <b>{titrePromo(p)}</b>
                <small>{p.itemName ? t('promosPage.onDish') : t('promosPage.wholeOrder')} · {p.active ? t('promosPage.stateActive') : t('promosPage.statePaused')}</small>
              </span>
              <button type="button" role="switch" aria-checked={!!p.active} className={`ec-interrupteur${p.active ? ' on' : ''}`}
                aria-label={`${t('promosPage.switchAria')} : ${titrePromo(p)}`} aria-busy={togglingId === p.id} disabled={togglingId === p.id}
                onClick={() => toggleActive(p)} />
            </LigneGlissante>
          ))}
        </div>
      )}

      {!formOpen ? (
        <button type="button" className="ec-bouton ec-bouton--iris" style={{ marginTop: 14 }} onClick={() => setFormOpen(true)}>{t('promosPage.addPromo')}</button>
      ) : APPLI ? (
        // Application : le formulaire dans une feuille, « Créer » épinglé en bas (il était au bout d'une carte, sous la page).
        <SousEcran titre={t('promosPage.newPromo')} onFermer={() => setFormOpen(false)} pied={
          <button type="button" className="btn-gold" style={{ width: '100%', minHeight: 48 }} disabled={saving} onClick={createPromo}>{saving ? '...' : t('promosPage.createPromo')}</button>
        }>
          {champsPromo}
        </SousEcran>
      ) : (
        <div className="ec-formulaire">
          <p className="ec-feuille-titre">{t('promosPage.newPromo')}</p>
          {champsPromo}
          <button type="button" className="ec-bouton ec-bouton--iris" disabled={saving} onClick={createPromo}>{saving ? '...' : t('promosPage.createPromo')}</button>
          <button type="button" className="ec-bouton ec-bouton--texte" onClick={() => setFormOpen(false)}>{t('promosPage.cancel')}</button>
        </div>
      )}
      <p className="ec-aide" style={{ marginTop: 10 }}>{t('promosPage.intro')}</p>

      {/* Fondateur, 2026-10-07 : aucune commission supplémentaire sur une promotion — 10 % du total payé par le client, c'est tout
          (la commission est calculée sur le sous-total net des remises, routes/orders.js). L'encart avait un filet lime sur
          fond clair (interdit, règle 1 du CLAUDE.md) : c'est maintenant une rangée à tuile, sans cadre. */}
      <div className="ec-ligne ec-ligne--note" role="note">
        <span className="ec-ligne-tuile" aria-hidden="true"><Icone nom="euro" taille={20} /></span>
        <span className="ec-ligne-texte">
          <b>{t('promosPage.noExtraCommissionTitle')}</b>
          <small>{t('promosPage.noExtraCommissionText')}</small>
          <small>{t('promosPage.noExtraCommissionExample')}</small>
        </span>
      </div>

      <AvantageFairide restaurant={restaurant} restoId={restoId} token={token} toast={toast} t={t} loadDashboard={loadDashboard} onChanged={loadPromos} />

      {/* Bons cadeaux : vendus au comptoir, utilisables sur les commandes Fairide (déplacés ici quand le module
          Réservations a été retiré, 2026-09-25). Les deux blocs partagés gardent leur contenu ; leur cadre s'efface dans
          la feuille (.ec-bloc, ecran-commerce.css). */}
      <div className="ec-bloc"><MiseEnAvant restoId={restoId} token={token} toast={toast} /></div>
      <div className="ec-bloc"><GiftVouchers restoId={restoId} token={token} toast={toast} restaurant={restaurant} /></div>

      <ConfirmDialog open={!!aSupprimer} icone="etiquette" danger title={t('promosPage.deleteConfirmTitle')}
        message={aSupprimer ? titrePromo(aSupprimer) : ''} detail={t('promosPage.deleteConfirmDetail')}
        confirmLabel={t('promosPage.deletePromo')} loading={!!deletingId}
        onConfirm={() => deletePromo(aSupprimer)} onCancel={() => setASupprimer(null)} />
    </CadreSite>
  );
}
