import { useEffect, useId, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StarsDisplay } from '../../components/Stars';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import EtatVide from '../../components/EtatVide';
import CadreSite from '../../components/commerce/CadreSite';
import { ContexteAvis, SignatureReponse } from '../../components/AvisSignes';
import ErrorCard from '../../components/ErrorCard';
import ConfirmDialog from '../../components/ConfirmDialog';

// La réponse du restaurateur est publique (visible aux clients sur la fiche resto, voir
// RestaurantMenu.jsx) — pensée pour se justifier publiquement en cas d'avis contestable, pas comme
// un canal de discussion privé.
//
// BANDEAU ET FEUILLE (fondateur, 2026-10-19, section 4 de finitions-appli.html) : la note moyenne et le nombre d'avis
// montent sur le bandeau iris (étoiles blanches) ; chaque avis est une rangée à filet — l'initiale du client dans une tuile,
// son nom, ses étoiles, son commentaire, puis la réponse publique sous un trait iris. Répondre, modifier, enregistrer :
// les mêmes gestes et le même appel qu'avant (PATCH /reviews/:id/reply).
export default function ReviewsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, reviews, avisEnEchec, loadDashboard, restoId } = useOutletContext();
  const [editingId, setEditingId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  /* AUDIT DU 19/10, shop-114. (1) Le serveur ne rend que 50 avis par page : « Voir plus » charge les suivants (`plus`), un
     commerce avec 73 avis ne voyait jamais les 23 plus anciens. (2) Retirer sa réponse : un vrai bouton, avec confirmation,
     au lieu de vider la case et lire « Réponse enregistrée ». (3) Un avis abusif se signale (page /signaler, DSA art. 16) :
     seul l'admin peut le retirer. */
  const [plus, setPlus] = useState([]);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  /* « SIGNER MES RÉPONSES » (audit design 2, idée 11f, 2026-10-19) : le prénom qui signe toutes les réponses publiques du
     commerce (« — Marco »), sur sa fiche et ici. Facultatif, enregistré côté serveur (migration 051,
     PATCH /restaurants/:id/review-signature) ; vide = réponses non signées. */
  const idSignature = useId();
  const signature = reviews?.signature || '';
  const [brouillonSignature, setBrouillonSignature] = useState(signature);
  const [signatureEnCours, setSignatureEnCours] = useState(false);
  useEffect(() => { setBrouillonSignature(signature); }, [signature]);
  async function enregistrerSignature(e) {
    e.preventDefault();
    setSignatureEnCours(true);
    try {
      const r = await api(`/restaurants/${restoId}/review-signature`, { method: 'PATCH', token, body: { signature: brouillonSignature } });
      toast(r.signature ? t('serviceCommerce.signerToast', { name: r.signature }) : t('serviceCommerce.signerToastVide'), 'succes');
      await loadDashboard(restoId);
    } catch (err) { toast(err.message, 'erreur'); } finally { setSignatureEnCours(false); }
  }

  function startReply(review) {
    setEditingId(review.id);
    setReplyDrafts((prev) => ({ ...prev, [review.id]: review.restaurantReply || '' }));
  }

  async function saveReply(reviewId, texte = replyDrafts[reviewId] || '') {
    setSaving(true);
    try {
      const r = await api(`/reviews/${reviewId}/reply`, { method: 'PATCH', token, body: { reply: texte } });
      toast(t(r.restaurantReply ? 'reviewsResto.toastSaved' : 'reviewsResto.toastRemoved'), 'succes');
      setEditingId(null);
      setARetirer(null);
      // Un avis des pages suivantes n'est pas relu par loadDashboard (première page seulement) : on le met à jour ici.
      setPlus((l) => l.map((x) => (x.id === reviewId ? { ...x, restaurantReply: r.restaurantReply, restaurantReplyAt: r.restaurantReplyAt } : x)));
      await loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setSaving(false);
    }
  }

  const premiers = reviews?.reviews || [];
  const liste = [...premiers, ...plus.filter((x) => !premiers.some((p) => p.id === x.id))];
  async function voirPlus() {
    setChargementPlus(true);
    try {
      const r = await api(`/restaurants/${restoId}/reviews?offset=${liste.length}`);
      setPlus((l) => [...l, ...(r.reviews || [])]);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setChargementPlus(false);
    }
  }

  const note = Number(restaurant.rating || 0).toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Pas d'étoiles sans avis, ici comme côté client : restaurants.rating vaut 4,5 par défaut en base, et le
  // commerçant voyait 4,5 étoiles remplies à côté de « aucun avis » (RES-15 du plan de test).
  const sous = restaurant.reviewCount > 0 ? (
    <span className="ec-avis-note">
      <span className="ec-avis-etoiles"><StarsDisplay value={restaurant.rating} size={15} /></span>
      {t('reviewsResto.ratingWithCount', { rating: note, count: restaurant.reviewCount })}
    </span>
  ) : t('reviewsResto.noReviewsYet');

  return (
    <CadreSite appli lecture titre={t('reviewsResto.title')} sous={sous}>
      {!reviews && avisEnEchec && <ErrorCard onRetry={() => loadDashboard(restoId)} />}
      {reviews && liste.length === 0 && <EtatVide icone="etoile" titre={t('reviewsResto.none')} />}
      {liste.length > 0 && (
        <div className="ec-lignes">
          {liste.map((r) => (
            <div key={r.id} className="ec-ligne ec-ligne--haut">
              <span className="ec-ligne-tuile ec-ligne-tuile--initiale" aria-hidden="true">{String(r.clientName || '?').trim().charAt(0).toUpperCase()}</span>
              <div className="ec-ligne-texte">
                <div className="ec-avis-tete">
                  <b>{r.clientName}</b>
                  <StarsDisplay value={r.foodRating} size={13} />
                </div>
                <ContexteAvis avis={r} className="ec-avis-contexte" />
                {r.foodComment && <p className="ec-avis-commentaire">{r.foodComment}</p>}

                {r.restaurantReply && editingId !== r.id && (
                  <div className="ec-avis-reponse">
                    <small>{t('reviewsResto.yourReply')}</small>
                    <p>{r.restaurantReply}</p>
                    <SignatureReponse signature={signature} />
                    <button type="button" className="ec-lien" onClick={() => startReply(r)}>{t('reviewsResto.edit')}</button>
                    {' · '}
                    <button type="button" className="ec-lien" onClick={() => setARetirer(r)}>{t('reviewsResto.removeReply')}</button>
                  </div>
                )}
                {!r.restaurantReply && editingId !== r.id && (
                  <button type="button" className="ec-lien" onClick={() => startReply(r)}>{t('reviewsResto.reply')}</button>
                )}
                {editingId !== r.id && (
                  <p className="small" style={{ margin: '6px 0 0' }}>
                    <Link to={`/signaler?type=review&id=${encodeURIComponent(r.id)}&nom=${encodeURIComponent(t('reviewsResto.reportName', { name: r.clientName || '' }))}`}>{t('reviewsResto.report')}</Link>
                  </p>
                )}
                {editingId === r.id && (
                  <div className="ec-avis-edition">
                    <textarea
                      rows={3}
                      maxLength={1000}
                      aria-label={t('reviewsResto.yourReply')}
                      value={replyDrafts[r.id] || ''}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder={t('reviewsResto.phReply')}
                      style={{ width: '100%' }}
                    />
                    <button type="button" className="ec-bouton ec-bouton--iris" disabled={saving} onClick={() => saveReply(r.id)}>{saving ? '...' : t('reviewsResto.save')}</button>
                    <button type="button" className="ec-bouton ec-bouton--texte" onClick={() => setEditingId(null)}>{t('reviewsResto.cancel')}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {reviews && reviews.count > liste.length && (
        <button type="button" className="ec-bouton ec-bouton--texte" disabled={chargementPlus} onClick={voirPlus}>
          {chargementPlus ? '...' : t('reviewsResto.showMore', { n: reviews.count - liste.length })}
        </button>
      )}
      <ConfirmDialog open={!!aRetirer} danger
        title={t('reviewsResto.removeReplyTitle')}
        message={t('reviewsResto.removeReplyText')}
        confirmLabel={t('reviewsResto.removeReply')}
        cancelLabel={t('reviewsResto.cancel')}
        loading={saving}
        onCancel={() => setARetirer(null)}
        onConfirm={() => saveReply(aRetirer.id, '')} />
      <section className="ec-bloc" aria-labelledby={idSignature}>
        <p className="ec-feuille-titre" id={idSignature}>{t('serviceCommerce.signerTitre')}</p>
        <p className="ec-aide">{t('serviceCommerce.signerAide')}</p>
        <form className="ec-signature" onSubmit={enregistrerSignature}>
          <input aria-labelledby={idSignature} maxLength={30} autoComplete="given-name" value={brouillonSignature}
            placeholder={t('serviceCommerce.signerPh')} onChange={(e) => setBrouillonSignature(e.target.value)} />
          <button type="submit" className="ec-bouton ec-bouton--iris" disabled={signatureEnCours || brouillonSignature.trim() === signature}>
            {signatureEnCours ? '…' : t('serviceCommerce.signerEnregistrer')}
          </button>
        </form>
      </section>
    </CadreSite>
  );
}
