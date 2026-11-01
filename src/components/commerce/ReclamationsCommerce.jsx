import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import { vibrer } from '../../gestes';

/* PLATS MANQUANTS SIGNALÉS (fondateur, 2026-10-31 ; reclamationsPlats.js côté serveur). En tête de Commandes, une carte par
   réclamation qui attend : ce que le client dit manquer, sa photo, et l'heure où, sans réponse, il est remboursé. Deux
   gestes, sans photo à prendre : « Rembourser » (iris : le lime reste à la commande en cours) ou « Contester ». Relue toutes
   les 30 secondes, comme une commande. */
export default function ReclamationsCommerce({ restoId, token, toast }) {
  const { t } = useLanguage();
  const [liste, setListe] = useState([]);
  const [enCours, setEnCours] = useState(null);
  const charger = useCallback(() => {
    if (!restoId || !token) return;
    api(`/orders/restaurant/${restoId}/missing-items`, { token }).then((l) => setListe(Array.isArray(l) ? l : [])).catch(() => {});
  }, [restoId, token]);
  useEffect(() => {
    charger();
    const id = setInterval(charger, 30000);
    return () => clearInterval(id);
  }, [charger]);

  async function decider(r, geste) {
    vibrer();
    setEnCours(r.id);
    try {
      await api(`/orders/${r.orderId}/missing-items/${geste}`, { method: 'PATCH', token, body: {} });
      toast(t(geste === 'refund' ? 'reclamationsResto.toastRembourse' : 'reclamationsResto.toastConteste'));
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }

  const attente = liste.filter((r) => r.statut === 'en_attente');
  if (!attente.length) return null;
  return (
    <section className="ec-reclamations" aria-label={t('reclamationsResto.titre')}>
      {attente.map((r) => (
        <article key={r.id} className="ec-reclamation">
          <div className="ec-reclamation-tete">
            <span><b>{t('reclamationsResto.titre')}</b><small>{[r.numero && t('reclamationsResto.numero', { n: r.numero }), r.client].filter(Boolean).join(' · ')}</small></span>
            <b className="ec-reclamation-montant">{euros(r.montant)}</b>
          </div>
          <ul className="ec-reclamation-plats">{(r.lignes || []).map((l) => <li key={l.lineId}>{l.qty}× {l.name}</li>)}</ul>
          {r.photo && <a className="ec-reclamation-photo" href={r.photo} target="_blank" rel="noreferrer"><img src={r.photo} alt={t('reclamationsResto.photo')} /><span>{t('reclamationsResto.photo')}</span></a>}
          <p className="ec-aide">{r.silenceVautAccord
            ? t('reclamationsResto.echeance', { time: new Date(r.echeance).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })
            : t('reclamationsResto.echeanceEquipe')}</p>
          <button type="button" className="ec-bouton ec-bouton--iris" disabled={enCours === r.id} onClick={() => decider(r, 'refund')}>
            {t('reclamationsResto.rembourser', { montant: euros(r.montant) })}
          </button>
          <button type="button" className="ec-bouton ec-bouton--texte" disabled={enCours === r.id} onClick={() => decider(r, 'contest')}>
            {t('reclamationsResto.contester')}
          </button>
        </article>
      ))}
    </section>
  );
}
