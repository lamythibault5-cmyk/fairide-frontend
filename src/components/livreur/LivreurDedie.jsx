import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import ConfirmDialog from '../ConfirmDialog';
import Icone from '../Icone';

/* LIVREUR DÉDIÉ D'UN COMMERCE : C'EST LE LIVREUR QUI DÉCIDE (audit du 19/10, shop-301 ; backend livreurDedie.js).
 *
 * Avant, un commerce faisait d'un livreur son « livreur dédié » en tapant son e-mail : le livreur ne voyait plus que les
 * courses de ce commerce, sans rien ici pour le lui dire. Maintenant le commerce envoie une invitation, qui s'affiche sur
 * ce tableau de bord : le livreur accepte ou refuse, et rien ne change pour lui avant qu'il accepte. Une fois dédié, la
 * carte le rappelle (c'est pour ça qu'il ne voit que ces courses) et il peut quitter le commerce d'un geste. Refuser ou
 * partir n'a aucune conséquence pour lui : le serveur ne le note nulle part ailleurs que sur l'invitation.
 * Rien à afficher (le cas de presque tous les livreurs) : la carte n'apparaît pas. */
export default function LivreurDedie({ token, toast, onChange }) {
  const { t } = useLanguage();
  const [etat, setEtat] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const [quitter, setQuitter] = useState(false);
  const lire = useCallback(() => {
    api('/couriers/me/dedicated', { token }).then((r) => setEtat(r && !Array.isArray(r) ? r : null)).catch(() => {});
  }, [token]);
  useEffect(() => { lire(); }, [lire]);

  async function geste(cle, chemin, message) {
    setEnCours(cle);
    try {
      const r = await api(chemin, { method: 'POST', token });
      setEtat(r);
      toast(message);
      onChange?.();
    } catch (e) {
      toast(e.message, 'erreur');
      lire();
    } finally {
      setEnCours(null);
    }
  }

  const invitations = etat?.invitations || [];
  const actuel = etat?.current || null;
  if (!actuel && !invitations.length) return null;
  return (
    <>
      {invitations.map((inv) => (
        <div key={inv.id} className="card" role="status" style={{ marginBottom: 12 }}>
          <b><Icone nom="commerce" taille={16} className="icone-texte" />{' '}{t('livreurDedie.title')}</b>
          <p style={{ margin: '6px 0 4px' }}>{t('livreurDedie.invitation', { name: inv.restaurantName })}</p>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('livreurDedie.explain')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-teal" disabled={!!enCours}
              onClick={() => geste(inv.id, `/couriers/me/dedicated/invitations/${inv.id}/accept`, t('livreurDedie.accepted', { name: inv.restaurantName }))}>
              {enCours === inv.id ? '…' : t('livreurDedie.accept')}
            </button>
            <button type="button" className="btn-outline" disabled={!!enCours}
              onClick={() => geste(inv.id, `/couriers/me/dedicated/invitations/${inv.id}/refuse`, t('livreurDedie.refused'))}>
              {t('livreurDedie.refuse')}
            </button>
          </div>
        </div>
      ))}
      {actuel && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>
            <Icone nom="commerce" taille={16} className="icone-texte" />{' '}{t('livreurDedie.current', { name: actuel.restaurantName })}
          </p>
          <button type="button" className="btn-outline btn-sm" disabled={!!enCours} onClick={() => setQuitter(true)}>{t('livreurDedie.leave')}</button>
        </div>
      )}
      <ConfirmDialog open={quitter} title={t('livreurDedie.leaveTitle', { name: actuel?.restaurantName || '' })} message={t('livreurDedie.leaveText')}
        confirmLabel={t('livreurDedie.leave')} loading={enCours === 'quitter'} onCancel={() => setQuitter(false)}
        onConfirm={async () => { await geste('quitter', '/couriers/me/dedicated/leave', t('livreurDedie.left')); setQuitter(false); }} />
    </>
  );
}
