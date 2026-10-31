import { useState } from 'react';
import { api, apiUpload } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import { vibrer } from '../../gestes';
import Icone from '../Icone';

/* PLAT MANQUANT (fondateur, 2026-10-31 ; reclamationsPlats.js côté serveur). Le client coche les plats, photographie ce qu'il
   a reçu et confirme sur l'honneur ; le commerce rembourse ou conteste, et sans réponse en 2 heures il est remboursé. Le
   texte dit seulement ce qui est vrai : le commerce reçoit la demande et la photo, et peut la contester. Une commande livrée
   et payée en ligne, dans les 24 heures. */
export const DELAI_RECLAMATION_H = 24;
export function peutReclamer(o) {
  const livree = Number(o.deliveredAt || 0);
  return o.status === 'livre' && o.paid && o.paymentMode !== 'on_site' && livree > 0 && Date.now() - livree < DELAI_RECLAMATION_H * 3600000;
}

const heure = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Où en est la réclamation, sous la commande. Contestée : « Je maintiens » ouvre un ticket pour l'équipe.
export function EtatReclamation({ reclamation: r, orderId, token, toast, onChange }) {
  const { t } = useLanguage();
  const [envoi, setEnvoi] = useState(false);
  async function maintenir() {
    setEnvoi(true);
    try { onChange(await api(`/orders/${orderId}/missing-items/maintain`, { method: 'POST', token, body: {} })); } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }
  const texte = {
    en_attente: t('orders.reclamationAttente', { time: heure(r.echeance) }),
    remboursee: t('orders.reclamationRemboursee', { montant: euros(r.montant) }),
    contestee: t('orders.reclamationContestee'),
    maintenue: t('orders.reclamationEquipe'),
    equipe: t('orders.reclamationEquipe')
  }[r.statut];
  return (
    <div className="reclamation-etat">
      <p className="small" style={{ margin: '8px 0 0' }}>{texte}</p>
      {r.statut === 'contestee' && (
        <button type="button" className="suivi-lien" disabled={envoi} onClick={maintenir}>{envoi ? '…' : t('orders.reclamationMaintenir')}</button>
      )}
    </div>
  );
}

export default function ReclamationPlat({ order, token, toast, onReclame, onAnnuler }) {
  const { t } = useLanguage();
  const lignes = (order.items || []).filter((i) => i.lineId && Number(i.price) > 0);
  const [choix, setChoix] = useState({});
  const [photo, setPhoto] = useState(null);
  const [honneur, setHonneur] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const montant = lignes.reduce((s, l) => s + (choix[l.lineId] || 0) * Math.max(0, Number(l.price) - Number(l.discount || 0) / l.qty), 0);
  const pret = montant > 0 && photo && honneur;

  function basculer(l) { vibrer(); setChoix((c) => ({ ...c, [l.lineId]: c[l.lineId] ? 0 : 1 })); }
  async function envoyer() {
    if (!pret) return;
    setEnvoi(true);
    try {
      const lines = Object.entries(choix).filter(([, q]) => q > 0).map(([lineId, qty]) => ({ lineId, qty }));
      const r = await apiUpload(`/orders/${order.id}/missing-items`, { file: photo, fieldName: 'photo', token, fields: { lines: JSON.stringify(lines), honour: 'true' } });
      toast(t('orders.reclamationEnvoyee'));
      onReclame(r);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="reclamation">
      <p className="reclamation-titre">{t('orders.reclamationQuoi')}</p>
      {lignes.map((l) => {
        const q = choix[l.lineId] || 0;
        return (
          <div key={l.lineId} className={`reclamation-ligne${q ? ' on' : ''}`}>
            <button type="button" className="reclamation-case" aria-pressed={!!q} onClick={() => basculer(l)}>
              <span className="case" aria-hidden="true">{q ? <Icone nom="coche" taille={15} /> : null}</span>
              <span>{l.qty > 1 ? `${l.qty}× ` : ''}{l.name}</span>
            </button>
            {q > 0 && l.qty > 1 ? (
              <span className="reclamation-qte">
                <button type="button" aria-label="−" onClick={() => setChoix((c) => ({ ...c, [l.lineId]: Math.max(0, q - 1) }))}>−</button>
                {t('orders.reclamationSur', { n: q, total: l.qty })}
                <button type="button" aria-label="+" onClick={() => setChoix((c) => ({ ...c, [l.lineId]: Math.min(l.qty, q + 1) }))}>+</button>
              </span>
            ) : <b className="reclamation-prix">{euros(Number(l.price))}</b>}
          </div>
        );
      })}
      <label className={`reclamation-photo${photo ? ' ok' : ''}`}>
        <Icone nom="photo" taille={20} />
        <span>{photo ? t('orders.reclamationPhotoOk') : t('orders.reclamationPhoto')}</span>
        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
      </label>
      <label className="reclamation-honneur">
        <input type="checkbox" checked={honneur} onChange={(e) => setHonneur(e.target.checked)} />
        <span>{t('orders.reclamationHonneur')}</span>
      </label>
      {montant > 0 && <p className="reclamation-resume">{t('orders.reclamationResume', { montant: euros(montant) })}</p>}
      <button type="button" className="btn-gold reclamation-envoyer" disabled={!pret || envoi} onClick={envoyer}>
        {envoi ? '…' : montant > 0 ? t('orders.reclamationEnvoyer', { montant: euros(montant) }) : t('orders.reclamationChoisis')}
      </button>
      <button type="button" className="btn-ghost" onClick={onAnnuler}>{t('common.cancel')}</button>
    </div>
  );
}
