import { useEffect, useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';

// Mon commerce › Livraison : qui livre les commandes — les livreurs Fairride (par défaut) ou l'équipe du commerce.
// LE COMMERCE LIVRE AVEC SON ÉQUIPE (fondateur, 2026-11-02 ; maquettes/livraison-commerce, étape 1) : il choisit « Mon équipe
// livre », tape ses frais et signe la déclaration (ses livreurs sont ses salariés, il vend la livraison, il fait avancer la
// commande). Le texte vient du serveur (GET /restaurants/:id/restaurant-delivery, livraisonCommerce.js) : c'est celui qui est
// signé et haché, jamais une copie. Il l'active seul ; l'équipe Fairride en est prévenue et peut l'arrêter avec un motif.
// Remplace l'ancien écran « mes livreurs » (inviter des livreurs Fairride par e-mail), retiré avec ce mode.
export default function EcranLivreurs({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const [decl, setDecl] = useState(null);
  const [choix, setChoix] = useState(restaurant.deliveryMode === 'restaurant' ? 'equipe' : 'fairride');
  const [frais, setFrais] = useState(restaurant.ownDeliveryFee != null ? String(restaurant.ownDeliveryFee).replace('.', ',') : '');
  const [accepte, setAccepte] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let vivant = true;
    api(`/restaurants/${restoId}/restaurant-delivery`, { token }).then((d) => { if (vivant) setDecl(d); }).catch(() => {});
    return () => { vivant = false; };
  }, [restoId, token]);

  const actif = !!restaurant.restaurantDelivery?.actif;
  const arrete = !!restaurant.restaurantDelivery?.suspenduLe;
  const montant = Number(String(frais).replace(',', '.'));
  const montantValable = frais.trim() !== '' && Number.isFinite(montant) && montant >= 0 && montant <= 20;
  // Ce que le commerce reçoit par livraison : ses frais moins 10 %, la même règle que ses plats (déclaration, point 2). Les
  // 10 % arrondis au centime D'ABORD, comme le serveur (pricing.commissionFairide) : 2,45 € donnait 2,21 € ici, 2,20 € versés.
  const recu = montantValable ? (montant - +(montant * 0.1).toFixed(2)).toFixed(2).replace('.', ',') : null;

  async function envoyer(body, message) {
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/restaurant-delivery`, { method: 'PUT', token, body });
      await loadDashboard(restoId);
      toast(message, 'succes');
      onFermer();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  const activer = () => {
    if (!montantValable) { toast(t('editResto.ownFeeInvalid'), 'erreur'); return; }
    if (!accepte) { toast(t('livraisonEquipe.cocheDeclaration'), 'erreur'); return; }
    envoyer({ activer: true, frais: montant, accepte: true }, t('livraisonEquipe.toastActive'));
  };
  const revenir = () => envoyer({ activer: false }, t('livraisonEquipe.toastFairride'));

  const carte = (cle, titre, sous) => (
    <button type="button" className={`le-choix${choix === cle ? ' le-choix--on' : ''}`} aria-pressed={choix === cle} onClick={() => setChoix(cle)}>
      <span className="le-point" aria-hidden="true" />
      <span><b>{titre}</b><span>{sous}</span></span>
    </button>
  );

  return (
    <SousEcran titre={t('editResto.delivery')} onFermer={onFermer}>
      <p className="ec-feuille-titre" style={{ marginTop: 0 }}>{t('livraisonEquipe.question')}</p>
      {carte('fairride', t('livraisonEquipe.fairride'), t('livraisonEquipe.fairrideSous'))}
      {carte('equipe', t('livraisonEquipe.equipe'), t('livraisonEquipe.equipeSous'))}

      {choix === 'fairride' && actif && (
        <button type="button" className="btn-ghost" disabled={enCours} onClick={revenir} style={{ marginTop: 8 }}>
          {enCours ? '…' : t('livraisonEquipe.revenir')}
        </button>
      )}

      {choix === 'equipe' && arrete && (
        <p className="small" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--cream-dim)' }}>{t('livraisonEquipe.arrete')}</p>
      )}

      {choix === 'equipe' && !arrete && (
        <>
          <div className="field" style={{ maxWidth: 280, marginTop: 8 }}>
            <label htmlFor={ids + '-frais'}>{t('livraisonEquipe.frais')}</label>
            <input id={ids + '-frais'} inputMode="decimal" value={frais} onChange={(e) => setFrais(e.target.value)} placeholder="3,00" />
          </div>
          {recu && <p className="small le-recu">{t('livraisonEquipe.recu', { montant: recu })}</p>}
          {decl?.texte && (
            <div className="le-declaration">
              <p className="small" style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('livraisonEquipe.declarationTitre')}</p>
              <ul>{decl.texte.map((l) => <li key={l}>{l}</li>)}</ul>
              <p className="small" style={{ margin: 0, opacity: 0.7 }}>{decl.version}</p>
            </div>
          )}
          <label className="row" style={{ gap: 8, margin: '12px 0', cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
            <span>{t('livraisonEquipe.jAccepte')}</span>
          </label>
          <button type="button" className="btn-gold btn-block" disabled={enCours || !decl} onClick={activer}>
            {enCours ? '…' : actif ? t('livraisonEquipe.enregistrer') : t('livraisonEquipe.activer')}
          </button>
          <p className="small" style={{ marginTop: 8 }}>{t('livraisonEquipe.apres')}</p>
        </>
      )}
    </SousEcran>
  );
}
