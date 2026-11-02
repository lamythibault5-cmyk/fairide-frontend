import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

// LIVRAISON PAR L'ÉQUIPE DU COMMERCE, côté équipe (fondateur, 2026-11-02 ; backend livraisonCommerce.js). Le commerce l'active
// seul en signant sa déclaration ; l'équipe en voit l'état ici et peut l'ARRÊTER, pour l'un des motifs de la déclaration
// (point 6), avec les faits écrits : c'est une décision motivée (exposé envoyé au commerce, recours). « Lever l'arrêt » laisse
// le commerce le réactiver en re-signant. `onChanged` relit la fiche.
export default function LivraisonEquipeAdmin({ restaurantId, etat, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [faits, setFaits] = useState('');
  const [enCours, setEnCours] = useState(false);
  if (!etat || (!etat.actif && !etat.suspenduLe && !etat.aResigner)) return null;

  async function appel(chemin, body, message) {
    setEnCours(true);
    try {
      await api(`/admin/restaurants/${restaurantId}/restaurant-delivery/${chemin}`, { method: 'POST', token, body });
      toast(message, 'succes');
      setFaits('');
      onChanged?.();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  const date = (d) => (d ? new Date(d).toLocaleDateString('fr-BE') : '');
  return (
    <div className="small" style={{ margin: '6px 0', padding: '8px 10px', borderRadius: 8, background: 'var(--cream-dim)' }}>
      {etat.suspenduLe ? (
        <>
          <b>{tr('adminRestos.equipeArretee', { date: date(etat.suspenduLe) })}</b>
          <button type="button" className="btn-outline btn-sm" style={{ marginLeft: 8 }} disabled={enCours} onClick={() => appel('resume', {}, tr('adminRestos.equipeLeveeToast'))}>{tr('adminRestos.equipeLever')}</button>
        </>
      ) : (
        <>
          <b>{tr('adminRestos.equipeActive', { montant: Number(etat.frais || 0).toFixed(2).replace('.', ','), date: date(etat.signeeLe), version: etat.version })}</b>
          {etat.renfort && <span className="pill" style={{ marginLeft: 6 }}>{tr('adminRestos.equipeRenfort')}</span>}
          {etat.aResigner && <span className="pill" style={{ marginLeft: 6 }}>{tr('adminRestos.equipeAResigner')}</span>}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            <input style={{ flex: '1 1 260px', fontSize: 12 }} placeholder={tr('adminRestos.equipeFaitsPh')} value={faits} onChange={(e) => setFaits(e.target.value)} aria-label={tr('adminRestos.equipeFaitsPh')} />
            <button type="button" className="btn-outline btn-sm" disabled={enCours || faits.trim().length < 20} onClick={() => appel('stop', { facts: faits.trim() }, tr('adminRestos.equipeArreteeToast'))}>{tr('adminRestos.equipeArreter')}</button>
          </div>
        </>
      )}
    </div>
  );
}
