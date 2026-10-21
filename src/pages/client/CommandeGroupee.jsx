import { useEffect, useRef, useState } from 'react';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import useRevalidation from '../../useRevalidation';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { euros, remiseLigne } from '../../prixPlat';
import { experienceApp, lienPublic } from '../../natif';
import ConfirmDialog from '../../components/ConfirmDialog';
import EtatVide from '../../components/EtatVide';
import Icone from '../../components/Icone';
import { SkeletonCards, SqueletteEcran } from '../../components/Skeleton';
import { BandeauCommande, FeuilleCommande, BarreCommande, RouteCommande } from '../../components/EcranCommande';
import { entrerDansGroupe, quitterGroupe, retenirGroupeACommander, groupeACommander, oublierGroupeACommander } from '../../commandeGroupee';
import '../../ecran-equipe-groupe.css';

const APPLI = experienceApp();

/* /groupe/:code — LA COMMANDE GROUPÉE (comparaison avec Uber Eats, 15 oct. 2026 ; backend routes/commandesGroupees.js).
 *
 * Chacun compose sa part dans SON panier, sur la carte habituelle du commerce (options, consignes, allergies : rien de
 * refait), puis l'envoie ici. L'hôte voit toutes les parts, ferme le groupe : elles entrent dans son panier, chaque ligne
 * marquée « Pour <prénom> » pour que le commerce sépare les sachets, et il paie tout par le paiement habituel (fondateur :
 * l'hôte paie). Il faut un compte pour participer (route protégée), comme pour commander.
 *
 * L'ÉCRAN (2026-10-16, même famille que le panier : EcranCommande.jsx, ecran-equipe-groupe.css) : un bandeau iris (retour à
 * la carte, le commerce, « Commande groupée », qui paie et combien de participants, le vélo sur sa route), puis la feuille
 * blanche : inviter, ma part, toutes les parts (l'hôte), rangées à filets. UNE action lime, dans la barre du bas comme au
 * panier (le récapitulatif collant sur ordinateur) : fermer et commander pour l'hôte, sinon envoyer son panier, sinon
 * choisir ses plats. Le reste est iris ou discret. */
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
  // La carte du commerce, pour montrer le prix PAYÉ de chaque ligne (offre du commerce comprise), comme le panier et le
  // paiement (audit design 2 du 2026-10-19) : le groupe enregistre le prix plein, la remise s'applique à la commande.
  const [menu, setMenu] = useState(null);

  // Le groupe déjà affiché : une relecture qui échoue (réseau) le garde à l'écran au lieu de le remplacer par l'erreur.
  const gRef = useRef(null);
  const charger = () => api(`/group-orders/${encodeURIComponent(code)}`, { token })
    .then((r) => {
      if (r && r.code) {
        gRef.current = r;
        setG(r); setErreur(null);
        // Commandé, annulé ou expiré : le code ne doit plus partir avec une prochaine commande (audit du 19/10, checkout-08).
        if (!['open', 'locked'].includes(r.status) && groupeACommander(r.restaurant?.id) === r.code) oublierGroupeACommander();
      } else setErreur(t('groupOrder.notFound'));
    })
    .catch((e) => { if (!gRef.current) setErreur(e.message); });
  useEffect(() => { charger(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  // L'ÉCRAN SE TIENT À JOUR (audit du 19/10, CROSS-42) : lu une seule fois, il ne montrait pas à l'hôte les parts qui
  // arrivaient, ni aux invités que le groupe était fermé ou commandé. Relu toutes les 10 s (onglet visible) et au retour
  // sur l'onglet ou l'application.
  useAutoRefresh(charger, 10000);
  useRevalidation(charger);
  const restoId = g?.restaurant?.id;
  useEffect(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}`, { token }).then((r) => setMenu(r?.menu || null)).catch(() => {});
  }, [restoId, token]);

  // Premier chargement en échec : de quoi réessayer, en plus du retour aux commerces (CROSS-42).
  if (erreur && !g) return (
    <EtatVide icone="personnes" titre={erreur} actionVers="/restaurants" actionTexte={t('orders.emptyAction')}>
      <button type="button" className="btn-outline" onClick={() => { setErreur(null); charger(); }}>{t('restaurantMenu.retry')}</button>
    </EtatVide>
  );
  // Chargement dans l'app : le bandeau et la feuille dès la première image (Skeleton.jsx, audit « Look and feel »).
  if (!g) return experienceApp() ? <SqueletteEcran lignes={3} /> : <SkeletonCards count={2} />;

  const lien = lienPublic(`/groupe/${g.code}`);
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
    // Déjà fermé et ses parts déjà dans le panier : on y retourne sans les ajouter une seconde fois (audit du 19/10,
    // checkout-08 : un second appui doublait chaque plat).
    if (g.status === 'locked' && groupeACommander(g.restaurant.id) === g.code && String(cart.restaurantId) === String(g.restaurant.id) && cart.count > 0) {
      navigate('/panier');
      return;
    }
    setOccupe(true);
    try {
      const r = await api(`/group-orders/${g.code}/lock`, { method: 'POST', token });
      retenirGroupeACommander({ code: g.code, restaurantId: r.restaurant.id });
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
    try {
      await api(`/group-orders/${g.code}/${action}`, { method: 'POST', token });
      if (action === 'cancel') quitterGroupe();
      // Rouvert ou annulé : la prochaine commande de l'hôte ne vaut plus pour ce groupe.
      oublierGroupeACommander();
      charger();
    } catch (e) { toast(e.message, 'erreur'); }
  }

  // Prix payé d'une ligne : son prix plein moins la remise du plat (même règle que le panier, prixPlat.js remiseLigne).
  const prixPaye = (l) => Math.max(0, l.unitPrice * l.qty - remiseLigne(menu?.find((m) => m.id === l.itemId), l.qty));
  const totalPaye = +g.lines.reduce((a, l) => a + prixPaye(l), 0).toFixed(2);
  const parInvite = g.lines.reduce((acc, l) => { (acc[l.guestName] ||= []).push(l); return acc; }, {});
  const ouvert = g.status === 'open';
  const peutCommander = g.isHost && ['open', 'locked'].includes(g.status) && g.lines.length > 0;
  // L'UNIQUE action lime de l'écran : commander (hôte), sinon envoyer son panier, sinon aller choisir ses plats.
  const decisive = peutCommander ? 'commander' : ouvert && panierIci ? 'envoyer' : ouvert ? 'choisir' : null;

  // Une ligne d'une part : quantité, plat (et ses options), prix, et la croix pour la retirer tant que le groupe est ouvert.
  const ligneDePart = (l) => (
    <li key={l.id} className="eg-ligne">
      <span className="eg-qte">{l.qty}×</span>
      <span className="eg-ligne-texte">
        <b>{l.name}</b>
        {l.optionsSnapshot?.length > 0 && <small>{l.optionsSnapshot.map((o) => o.name).join(', ')}</small>}
      </span>
      <span className="eg-prix">{euros(prixPaye(l))}</span>
      {ouvert && (
        <button type="button" className="eg-retirer" onClick={() => retirer(l)} aria-label={`${t('groupOrder.remove')} : ${l.name}`} title={t('groupOrder.remove')}>
          <Icone nom="croix" taille={16} />
        </button>
      )}
    </li>
  );

  const libelleDecisif = decisive === 'commander' ? t('groupOrder.order')
    : decisive === 'envoyer' ? t('groupOrder.sendCart', { n: cart.count }) : t('groupOrder.pickDishes');
  const actionDecisive = decisive === 'commander' ? () => commander() : decisive === 'envoyer' ? envoyer : choisir;
  const barre = decisive && (
    <BarreCommande montant={g.total} className="eg-barre">
      <button type="button" className="btn-gold" disabled={occupe && decisive !== 'choisir'} onClick={actionDecisive}>
        {occupe && decisive !== 'choisir' ? '…' : libelleDecisif}
      </button>
    </BarreCommande>
  );
  const total = g.isHost && g.lines.length > 0 && (
    <div className="eg-total">
      <span>{t('groupOrder.estimateLabel')}</span>
      <b>{euros(totalPaye)}</b>
    </div>
  );

  return (
    <div className="eg-page ec-page sc-page">
      <BandeauCommande
        vers={`/restaurants/${g.restaurant.id}`}
        libelleRetour={t('panier.backToMenu')}
        haut={<b>{g.restaurant.name}</b>}
        titre={t('groupOrder.start')}
        sous={`${g.isHost ? t('groupOrder.youHost') : t('groupOrder.hostIs', { name: g.hostFirstName })} · ${t('groupOrder.participants', { n: g.participants })}`}
      >
        <RouteCommande position={g.status === 'open' ? 46 : g.status === 'ordered' ? 92 : 78} depart={8} />
      </BandeauCommande>

      <FeuilleCommande>
        {g.status === 'locked' && (
          <p className="eg-note" role="status"><Icone nom="cadenas" taille={18} />{g.isHost ? t('groupOrder.lockedHost') : t('groupOrder.lockedGuest', { name: g.hostFirstName })}</p>
        )}
        {/* Commandé et payé par l'hôte (audit du 19/10, checkout-08) : dit à tous, au lieu de « en train de commander » 24 h. */}
        {g.status === 'ordered' && (
          <p className="eg-note" role="status"><Icone nom="coche" taille={18} />{g.isHost ? t('groupOrder.orderedHost') : t('groupOrder.orderedGuest', { name: g.hostFirstName })}</p>
        )}
        {['expired', 'cancelled'].includes(g.status) && (
          <p className="eg-note" role="status"><Icone nom="horloge" taille={18} />{t('groupOrder.ended')}</p>
        )}

        <div className="sc-grille">
        <div className="sc-principal">
          {ouvert && (
            <section className="eg-section" aria-labelledby="eg-inviter">
              <h2 className="ec-section" id="eg-inviter">{t('groupOrder.inviteTitle')}</h2>
              <p className="eg-texte">{t('groupOrder.inviteText')}</p>
              <div className="eg-lien">
                <input readOnly value={lien} aria-label={t('groupOrder.inviteTitle')} onFocus={(e) => e.target.select()} />
                <button type="button" className="eg-bouton-iris" onClick={partager}><Icone nom="lien" taille={16} />{t('groupOrder.share')}</button>
              </div>
            </section>
          )}

          {ouvert && (
            <section className="eg-section" aria-labelledby="eg-ma-part">
              <h2 className="ec-section" id="eg-ma-part">{t('groupOrder.myPart')}</h2>
              {mesLignes.length === 0 && !panierIci && <p className="eg-texte">{t('groupOrder.myPartEmpty')}</p>}
              {mesLignes.length > 0 && <ul className="eg-lignes">{mesLignes.map(ligneDePart)}</ul>}
              {/* Les actions de la part qui ne sont pas l'action lime (elle est dans la barre du bas). */}
              {(decisive !== 'choisir' || (panierIci && decisive !== 'envoyer')) && (
                <div className="eg-actions">
                  {panierIci && decisive !== 'envoyer' && (
                    <button type="button" className="eg-bouton-iris eg-bouton-plein" disabled={occupe} onClick={envoyer}>{occupe ? '…' : t('groupOrder.sendCart', { n: cart.count })}</button>
                  )}
                  {decisive !== 'choisir' && <button type="button" className="eg-bouton-iris" onClick={choisir}>{t('groupOrder.pickDishes')}</button>}
                </div>
              )}
            </section>
          )}

          {g.isHost && (
            <section className="eg-section" aria-labelledby="eg-parts">
              <h2 className="ec-section" id="eg-parts">{t('groupOrder.allParts')}</h2>
              {g.lines.length === 0 ? <p className="eg-texte">{t('groupOrder.noPartsYet')}</p> : Object.entries(parInvite).map(([nom, lignes]) => (
                <div key={nom} className="eg-personne">
                  <div className="eg-personne-tete">
                    <span className="eg-initiale" aria-hidden="true">{nom.trim().charAt(0).toUpperCase()}</span>
                    <b>{nom}</b>
                    <span className="eg-prix">{euros(lignes.reduce((a, l) => a + prixPaye(l), 0))}</span>
                  </div>
                  <ul className="eg-lignes">{lignes.map(ligneDePart)}</ul>
                </div>
              ))}
              {total && <div className="eg-total-feuille">{total}<p className="eg-petit">{t('groupOrder.estimateNote')}</p></div>}
            </section>
          )}

          {g.isHost && ['open', 'locked'].includes(g.status) && (
            <div className="eg-hote">
              <p className="eg-petit">{t('groupOrder.hostPays')}</p>
              <div className="eg-actions">
                {g.status === 'locked' && <button type="button" className="eg-bouton-iris" onClick={() => hote('reopen')}>{t('groupOrder.reopen')}</button>}
                <button type="button" className="eg-discret" onClick={() => hote('cancel')}>{t('groupOrder.cancel')}</button>
              </div>
            </div>
          )}
        </div>
        {/* Site : le récapitulatif collant à droite, qui porte l'action lime (sur un téléphone, seule la barre en reste). */}
        {!APPLI && barre && (
          <aside className="sc-recap" aria-label={t('siteCommande.recap')}>
            <h2 className="sc-recap-titre">{t('siteCommande.recap')}</h2>
            <p className="sc-recap-sous">{g.restaurant.name} · {t('groupOrder.participants', { n: g.participants })}</p>
            {total && <div className="eg-recap-total">{total}</div>}
            {barre}
            {decisive === 'commander' && <p className="sc-recap-note">{t('groupOrder.estimateNote')}</p>}
          </aside>
        )}
        </div>
      </FeuilleCommande>

      {APPLI && barre}
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
