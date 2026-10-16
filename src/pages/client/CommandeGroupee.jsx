import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import ConfirmDialog from '../../components/ConfirmDialog';
import { entrerDansGroupe, quitterGroupe } from '../../commandeGroupee';

/* /groupe/:code — LA COMMANDE GROUPÉE (comparaison avec Uber Eats, 15 oct. 2026 ; backend routes/commandesGroupees.js).
 *
 * Chacun compose sa part dans SON panier, sur la carte habituelle du commerce (options, consignes, allergies : rien de
 * refait), puis l'envoie ici. L'hôte voit toutes les parts, ferme le groupe : elles entrent dans son panier, chaque ligne
 * marquée « Pour <prénom> » pour que le commerce sépare les sachets, et il paie tout par le paiement habituel (fondateur :
 * l'hôte paie). Il faut un compte pour participer (route protégée), comme pour commander. */
export default function CommandeGroupee() {
  const { code } = useParams();
  const { token } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [g, setG] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [confirmerRemplacement, setConfirmerRemplacement] = useState(null);

  const charger = () => api(`/group-orders/${encodeURIComponent(code)}`, { token })
    .then((r) => { if (r && r.code) { setG(r); setErreur(null); } else setErreur(t('groupOrder.notFound')); })
    .catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erreur) return <div className="card"><p className="small" role="alert" style={{ margin: 0 }}>{erreur}</p></div>;
  if (!g) return <p className="small">…</p>;

  const lien = `${window.location.origin}/groupe/${g.code}`;
  const mesLignes = g.lines.filter((l) => l.mine);
  const panierIci = cart.restaurantId && String(cart.restaurantId) === String(g.restaurant.id) && cart.count > 0;

  async function partager() {
    try {
      if (navigator.share) await navigator.share({ title: t('groupOrder.shareTitle', { name: g.restaurant.name }), url: lien });
      else { await navigator.clipboard.writeText(lien); toast(t('groupOrder.copied'), 'succes'); }
    } catch { /* partage annulé */ }
  }
  function choisir() {
    entrerDansGroupe({ code: g.code, restaurantId: g.restaurant.id, hostFirstName: g.hostFirstName });
    navigate(`/restaurants/${g.restaurant.id}`);
  }
  // Envoyer son panier : la part sur le serveur est REMPLACÉE, on y renvoie donc aussi ce qui y était déjà.
  async function envoyer() {
    setOccupe(true);
    try {
      const deja = mesLignes.map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds, optionsSnapshot: l.optionsSnapshot, unitPrice: l.unitPrice, note: l.note }));
      const panier = Object.values(cart.lines).map((l) => ({ itemId: l.itemId, qty: l.qty, optionItemIds: l.optionItemIds, optionsSnapshot: l.optionsSnapshot, unitPrice: l.unitPrice, note: l.note }));
      await api(`/group-orders/${g.code}/lines`, { method: 'PUT', token, body: { lines: [...deja, ...panier] } });
      cart.clear();
      if (!g.isHost) quitterGroupe();
      toast(t('groupOrder.sent'), 'succes');
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function retirer(ligne) {
    try { await api(`/group-orders/${g.code}/lines/${ligne.id}`, { method: 'DELETE', token }); charger(); } catch (e) { toast(e.message, 'erreur'); }
  }
  // L'hôte ferme le groupe : toutes les parts passent dans son panier, puis le panier s'ouvre.
  async function commander(force = false) {
    if (!force && cart.count > 0 && String(cart.restaurantId) !== String(g.restaurant.id)) { setConfirmerRemplacement(true); return; }
    setOccupe(true);
    try {
      const r = await api(`/group-orders/${g.code}/lock`, { method: 'POST', token });
      cart.addMany({
        restaurantId: r.restaurant.id, restaurantName: r.restaurant.name,
        lignes: r.lines.map((l) => ({ itemId: l.itemId, name: l.name, qty: l.qty, optionItemIds: l.optionItemIds, optionsSnapshot: l.optionsSnapshot, unitPrice: l.unitPrice,
          note: [t('groupOrder.forName', { name: l.guestName }), l.note].filter(Boolean).join(' · ') }))
      });
      quitterGroupe();
      navigate('/panier');
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }
  async function hote(action) {
    try { await api(`/group-orders/${g.code}/${action}`, { method: 'POST', token }); if (action === 'cancel') quitterGroupe(); charger(); } catch (e) { toast(e.message, 'erreur'); }
  }

  const parInvite = g.lines.reduce((acc, l) => { (acc[l.guestName] ||= []).push(l); return acc; }, {});
  const ouvert = g.status === 'open';
  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('groupOrder.title', { name: g.restaurant.name })}</h2>
      <p className="small" style={{ margin: '0 0 12px' }}>
        {g.isHost ? t('groupOrder.youHost') : t('groupOrder.hostIs', { name: g.hostFirstName })} · {t('groupOrder.participants', { n: g.participants })}
      </p>
      {g.status === 'locked' && <p className="small paiement-encart" role="status">{g.isHost ? t('groupOrder.lockedHost') : t('groupOrder.lockedGuest', { name: g.hostFirstName })}</p>}
      {['expired', 'cancelled'].includes(g.status) && <p className="small paiement-encart" role="status">{t('groupOrder.ended')}</p>}

      {ouvert && (
        <div className="card">
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('groupOrder.inviteTitle')}</h3>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('groupOrder.inviteText')}</p>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly value={lien} aria-label={t('groupOrder.inviteTitle')} style={{ flex: '1 1 200px' }} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn-outline" onClick={partager}>{t('groupOrder.share')}</button>
          </div>
        </div>
      )}

      {ouvert && (
        <div className="card">
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('groupOrder.myPart')}</h3>
          {mesLignes.length === 0 && !panierIci && <p className="small" style={{ margin: '0 0 8px' }}>{t('groupOrder.myPartEmpty')}</p>}
          {mesLignes.map((l) => (
            <div key={l.id} className="row small" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{l.qty} × {l.name}{l.optionsSnapshot?.length ? ` (${l.optionsSnapshot.map((o) => o.name).join(', ')})` : ''}</span>
              <button type="button" className="btn-danger-ghost" onClick={() => retirer(l)}>{t('groupOrder.remove')}</button>
            </div>
          ))}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {panierIci && <button type="button" className="btn-teal" disabled={occupe} onClick={envoyer}>{occupe ? '…' : t('groupOrder.sendCart', { n: cart.count })}</button>}
            <button type="button" className="btn-outline" onClick={choisir}>{t('groupOrder.pickDishes')}</button>
          </div>
        </div>
      )}

      {g.isHost && (
        <div className="card">
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('groupOrder.allParts')}</h3>
          {g.lines.length === 0 ? <p className="small" style={{ margin: 0 }}>{t('groupOrder.noPartsYet')}</p> : Object.entries(parInvite).map(([nom, lignes]) => (
            <div key={nom} style={{ marginBottom: 8 }}>
              <b className="small">{nom}</b>
              {lignes.map((l) => (
                <div key={l.id} className="row small" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>{l.qty} × {l.name} · {euros(l.unitPrice * l.qty)}</span>
                  {ouvert && <button type="button" className="btn-danger-ghost" onClick={() => retirer(l)}>{t('groupOrder.remove')}</button>}
                </div>
              ))}
            </div>
          ))}
          {g.lines.length > 0 && <p className="small" style={{ margin: '8px 0', fontWeight: 600 }}>{t('groupOrder.estimate', { total: euros(g.total) })}</p>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {['open', 'locked'].includes(g.status) && g.lines.length > 0 && (
              <button type="button" className="btn-gold" disabled={occupe} onClick={() => commander()}>{occupe ? '…' : t('groupOrder.order')}</button>
            )}
            {g.status === 'locked' && <button type="button" className="btn-outline" onClick={() => hote('reopen')}>{t('groupOrder.reopen')}</button>}
            {['open', 'locked'].includes(g.status) && <button type="button" className="btn-ghost" onClick={() => hote('cancel')}>{t('groupOrder.cancel')}</button>}
          </div>
          <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{t('groupOrder.hostPays')}</p>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmerRemplacement}
        title={t('groupOrder.replaceTitle')}
        message={t('groupOrder.replaceText', { name: cart.restaurantName })}
        confirmLabel={t('groupOrder.order')}
        onCancel={() => setConfirmerRemplacement(null)}
        onConfirm={() => { setConfirmerRemplacement(null); commander(true); }}
      />
    </div>
  );
}
