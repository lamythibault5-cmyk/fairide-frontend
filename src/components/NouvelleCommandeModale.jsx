import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Modale from './Modale';
import ConfirmDialog from './ConfirmDialog';
import ReasonDialog from './admin/ReasonDialog';
import { BandeauAllergie } from './conformite/CommandeConformite';
import { orderTypeLabel } from '../orderStatus';
import { euros } from '../prixPlat';
import { vibrer } from '../gestes';
import Icone from './Icone';
import { SegmentGlisse } from './commerce/BandeauCommerce';
import AnneauDelai from './commerce/AnneauDelai';
import ListePlats from './commerce/ListePlats';
import { heurePrete, numeroCommande, ordinal, ouEstLeClient, prenom, rangClient } from './commerce/clientCommande';
import '../ecran-commerce.css';

/* LA COMMANDE QUI VIENT D'ARRIVER, ACCEPTÉE D'UN GESTE (fondateur, 2026-10-01 ; refaite à l'audit design 2, 2026-10-19).
 *
 * Avant : la feuille montrait la commande et un bouton lime « Voir et accepter » qui n'ouvrait que son détail, sans
 * « Accepter » — il fallait fermer, descendre sous l'alarme et accepter sur la carte, pendant que les 15 minutes couraient.
 * Maintenant tout ce qu'il faut pour décider est ici : « Nouvelle commande », #numéro · type · payée, l'anneau du temps qui
 * reste, QUI est le client pour ce commerce (« Nora · Molenbeek, 1,2 km » et « 3e commande chez toi », comptée sur
 * l'historique que le tableau de bord a déjà), les plats (quantité en iris, notes du client visibles), la note de
 * livraison, une demande d'allergie s'il y en a, le temps de préparation (À l'heure / +10 / +20 / +30 : mêmes valeurs et
 * même appel que la carte, PATCH /orders/:id/accept { extraMinutes }), puis UN bouton lime « Accepter · prête vers 19:58 »,
 * et dessous Refuser (même motif obligatoire, ReasonDialog), Imprimer (avec le nombre d'exemplaires, si un terminal est
 * associé) et Plus tard. Pas de « Tu gardes X € » ici (fondateur, refusé à l'audit).
 *
 * Elle s'ouvre d'elle-même pour une commande arrivée APRÈS le chargement (jamais pour celles déjà là, même règle que
 * useNewOrderAlert), ou quand on touche « 1 commande à traiter » sur l'accueil (DashboardLayout lui passe `ouverte`). Elle
 * se ferme seule quand la commande n'attend plus (acceptée sur le terminal, refusée, expirée). */
export default function NouvelleCommandeModale({ orders, ready, restoId, loadDashboard, ouverte, setOuverte }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const vues = useRef(null);
  const [exemplaires, setExemplaires] = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [enPlus, setEnPlus] = useState(0);
  const [action, setAction] = useState(null);
  const [aRefuser, setARefuser] = useState(false);
  const [allergie, setAllergie] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const nouvelles = orders.filter((o) => o.status === 'nouveau' && o.paid);
    if (vues.current === null) { vues.current = new Set(nouvelles.map((o) => o.id)); return; }
    const arrivees = nouvelles.filter((o) => !vues.current.has(o.id));
    nouvelles.forEach((o) => vues.current.add(o.id));
    if (arrivees.length) setOuverte(arrivees.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, ready]);

  // Une autre commande ouverte : son propre temps de préparation, un exemplaire.
  useEffect(() => { setEnPlus(0); setExemplaires(1); }, [ouverte]);

  useEffect(() => {
    if (!ouverte || !restoId) return;
    api(`/restaurants/${restoId}/terminals`, { token }).then((d) => setTerminal((d.terminals || []).some((x) => !x.revokedAt))).catch(() => setTerminal(false));
  }, [ouverte, restoId, token]);

  // Toujours la dernière version de la commande : acceptée ailleurs (terminal, autre écran), elle n'attend plus.
  const o = ouverte ? orders.find((x) => x.id === ouverte) : null;
  const nAttendPlus = !!ouverte && (!o || o.status !== 'nouveau');
  useEffect(() => { if (nAttendPlus && !action) setOuverte(null); }, [nAttendPlus, action, setOuverte]);

  if (!o || o.status !== 'nouveau') return null;
  const fermer = () => setOuverte(null);
  const num = numeroCommande(o);

  async function reimprimer() {
    setEnvoi(true);
    try {
      await api(`/orders/${o.id}/print`, { method: 'POST', token, body: { copies: exemplaires } });
      toast(exemplaires > 1 ? t('ordersResto.toastTicketSentN', { n: exemplaires }) : t('ordersResto.ticketSentTerminal'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }

  async function agir(chemin, body, succes) {
    if (action) return;
    setAction(chemin);
    try {
      await api(`/orders/${o.id}/${chemin}`, { method: 'PATCH', token, body });
      succes?.();
      fermer();
      await loadDashboard?.(restoId, { fiche: false, annexes: false, silencieux: true });
    } catch (e) { toast(e.message, 'erreur'); } finally { setAction(null); }
  }
  // Accepter une demande d'allergie, c'est s'engager à la respecter (A1) : on le fait confirmer, comme sur la carte.
  const accepter = (allergyAck = false) => agir('accept', { extraMinutes: enPlus, ...(allergyAck ? { allergyAck: true } : {}) }, () => { vibrer('succes'); toast(t('serviceCommerce.toastAcceptee', { num }), 'succes'); });

  const rang = rangClient(o, orders);
  const lieu = ouEstLeClient(o);
  const pret = heurePrete(o, enPlus);
  const paiement = o.paymentMode === 'on_site' ? t('serviceCommerce.aPayerSurPlace', { amount: euros(o.total) }) : o.paid ? t('serviceCommerce.payeeEnLigne') : '';

  return (
    <>
      <Modale ariaLabel={t('serviceCommerce.nouvelleCommande')} onFermer={fermer}>
        <div className="nc">
          <div className="nc-tete">
            <div>
              <h3 className="modal-titre">{t('serviceCommerce.nouvelleCommande')}</h3>
              <p className="nc-sous">{[num && <b key="n">{num}</b>, orderTypeLabel(o, t), paiement].filter(Boolean).reduce((acc, x, i) => (i ? [...acc, ' · ', x] : [x]), [])}</p>
            </div>
            <AnneauDelai order={o} />
          </div>

          <div className="nc-client">
            <span className="nc-avatar" aria-hidden="true">{prenom(o.clientName).charAt(0).toUpperCase() || '?'}</span>
            <div>
              <b>{prenom(o.clientName)}</b>{lieu && <> · {lieu}</>}
              {rang && <small>{rang === 1 ? t('serviceCommerce.premiereCommande') : t('serviceCommerce.niemeCommande', { rang: ordinal(rang) })}</small>}
            </div>
          </div>

          <ListePlats items={o.items} />
          {o.deliveryNote && <p className="nc-note"><Icone nom="document" taille={16} />{o.deliveryNote}</p>}
          <BandeauAllergie order={o} />

          <p className="ec-feuille-titre">{t('ordersResto.extraPrepLabel')}</p>
          <SegmentGlisse libelle={t('ordersResto.extraPrepLabel')} valeur={enPlus} onChange={(v) => { vibrer('selection'); setEnPlus(v); }}
            options={[{ value: 0, label: t('ordersResto.extraPrepNone') }, ...[10, 20, 30].map((m) => ({ value: m, label: t('ordersResto.extraPrepMinutes', { n: m }) }))]} />
          <button type="button" className="ec-bouton ec-bouton--lime" disabled={!!action}
            onClick={() => { if (o.allergyRequest) setAllergie(true); else accepter(); }}>
            {action === 'accept' ? '…' : pret ? t('serviceCommerce.accepterPreteVers', { time: pret }) : t('ordersResto.accept')}
          </button>

          <div className="nc-liens">
            <button type="button" className="nc-lien" disabled={!!action} onClick={() => setARefuser(true)}>{t('ordersResto.refuse')}</button>
            {terminal && (
              <span className="nc-imprimer">
                <button type="button" className="nc-lien nc-lien--iris" disabled={envoi} onClick={reimprimer} aria-label={t('serviceCommerce.imprimer')}>
                  <Icone nom="imprimante" taille={18} /><span className="nc-imprimer-mot">{envoi ? t('ordersResto.printing') : t('serviceCommerce.imprimer')}</span>
                </button>
                <span className="exemplaires" role="group" aria-label={t('ordersResto.copiesLabel')}>
                  <button type="button" className="btn-ghost" disabled={exemplaires <= 1} onClick={() => setExemplaires((v) => Math.max(1, v - 1))} aria-label="−">−</button>
                  <b aria-live="polite">{exemplaires}</b>
                  <button type="button" className="btn-ghost" disabled={exemplaires >= 5} onClick={() => setExemplaires((v) => Math.min(5, v + 1))} aria-label="+">+</button>
                </span>
              </span>
            )}
            <button type="button" className="nc-lien" onClick={fermer}>{t('newOrder.later')}</button>
          </div>
        </div>
      </Modale>
      {/* Motif obligatoire : le serveur le refuse sans (MOTIF_REQUIS) et le transmet au client. */}
      <ReasonDialog open={aRefuser} danger
        title={t('ordersResto.confirmRefuseTitle')}
        message={`${t('ordersResto.confirmRefuseText', { name: o.clientName || '' })} ${t('ordersResto.refuseReasonHint')}`}
        label={t('ordersResto.refuseReasonLabel')}
        placeholder={t('ordersResto.refuseReasonPlaceholder')}
        confirmLabel={t('ordersResto.refuse')}
        onCancel={() => setARefuser(false)}
        onConfirm={(motif) => { setARefuser(false); agir('refuse', { reason: motif }); }} />
      <ConfirmDialog open={allergie}
        title={t('conformite.allergyConfirmTitle')}
        message={t('conformite.allergyConfirmText', { request: o.allergyRequest || '' })}
        confirmLabel={t('conformite.allergyConfirmAccept')}
        onCancel={() => setAllergie(false)}
        onConfirm={() => { setAllergie(false); accepter(true); }} />
    </>
  );
}
