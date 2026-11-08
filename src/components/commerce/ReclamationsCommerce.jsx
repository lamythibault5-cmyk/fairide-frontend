import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import { vibrer } from '../../gestes';
import ConfirmDialog from '../ConfirmDialog';
import ReasonDialog from '../admin/ReasonDialog';
import { useModeEquipe } from '../../modeEquipe';
import JoindreFairride from './JoindreFairride';

// Le plafond au-delà duquel seul le responsable rembourse (backend reclamationsPlats.REGLES.plafondAuto), pour un serveur
// plus ancien qui n'envoie pas encore `peutRembourser` / `plafond`.
const PLAFOND_DEFAUT = 15;

/* PLATS MANQUANTS SIGNALÉS (fondateur, 2026-10-31 ; reclamationsPlats.js côté serveur). En tête de Commandes, une carte par
   réclamation qui attend : ce que le client dit manquer, sa photo, et l'heure où, sans réponse, il est remboursé. Deux
   gestes, sans photo à prendre : « Rembourser » (iris : le lime reste à la commande en cours) ou « Contester ». Relue toutes
   les 30 secondes, comme une commande. */
export default function ReclamationsCommerce({ restoId, token, toast }) {
  const { t } = useLanguage();
  const [liste, setListe] = useState([]);
  const [enCours, setEnCours] = useState(null);
  /* DEUX GESTES QUI SE CONFIRMENT (revue des frictions du commerce, 2026-11-08). « Rembourser 18,00 € » partait au premier
   * toucher, sans dire ce qui sort du virement ; « Contester » n'envoyait aucun mot alors que le serveur en garde un et le
   * montre au client. Rembourser passe par une confirmation (ConfirmDialog), Contester par une fenêtre au motif facultatif
   * avec deux réponses toutes faites. Un membre de l'équipe ne voit plus « Rembourser » au-delà du plafond (le serveur
   * répondait 403 RECLAMATION_RESPONSABLE) : une ligne le dit, « Contester » reste. */
  const membreEquipe = useModeEquipe();
  const [aRembourser, setARembourser] = useState(null);
  const [aContester, setAContester] = useState(null);
  const charger = useCallback(() => {
    if (!restoId || !token) return;
    api(`/orders/restaurant/${restoId}/missing-items`, { token }).then((l) => setListe(Array.isArray(l) ? l : [])).catch(() => {});
  }, [restoId, token]);
  useEffect(() => {
    charger();
    const id = setInterval(charger, 30000);
    return () => clearInterval(id);
  }, [charger]);

  async function decider(r, geste, motif) {
    vibrer();
    setEnCours(r.id);
    try {
      await api(`/orders/${r.orderId}/missing-items/${geste}`, { method: 'PATCH', token, body: geste === 'contest' && motif ? { reason: motif } : {} });
      toast(t(geste === 'refund' ? 'reclamationsResto.toastRembourse' : 'reclamationsResto.toastConteste'));
      setARembourser(null); setAContester(null);
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }
  // Le serveur le dit (peutRembourser) ; un serveur plus ancien : la même règle, lue sur le mode équipe.
  const peutRembourser = (r) => (typeof r.peutRembourser === 'boolean' ? r.peutRembourser : !(membreEquipe && Number(r.montant) > PLAFOND_DEFAUT));

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
          {/* Ce qui sort de son virement s'il rembourse : sa part du montant, Fairride rend sa commission (G22, décision d'Owen du
              06/11/2026 ; `retenue` calculée par le serveur, absente d'un serveur plus ancien). */}
          {typeof r.retenue === 'number' && <p className="ec-aide">{t('reclamationsResto.retenue', { montant: euros(r.retenue) })}</p>}
          {peutRembourser(r) ? (
            <button type="button" className="ec-bouton ec-bouton--iris" disabled={enCours === r.id} onClick={() => setARembourser(r)}>
              {t('reclamationsResto.rembourser', { montant: euros(r.montant) })}
            </button>
          ) : <p className="ec-aide">{t('reclamationsResto.responsableSeul', { plafond: euros(r.plafond ?? PLAFOND_DEFAUT) })}</p>}
          <button type="button" className="ec-bouton ec-bouton--texte" disabled={enCours === r.id} onClick={() => setAContester(r)}>
            {t('reclamationsResto.contester')}
          </button>
          <JoindreFairride compact />
        </article>
      ))}
      <ConfirmDialog open={!!aRembourser} icone="euro"
        title={t('reclamationsResto.confirmTitre', { montant: euros(aRembourser?.montant || 0) })}
        message={typeof aRembourser?.retenue === 'number'
          ? t('reclamationsResto.confirmTexte', { montant: euros(aRembourser.montant), retenue: euros(aRembourser.retenue) })
          : t('reclamationsResto.confirmTexteSimple', { montant: euros(aRembourser?.montant || 0) })}
        confirmLabel={t('reclamationsResto.rembourser', { montant: euros(aRembourser?.montant || 0) })}
        loading={!!aRembourser && enCours === aRembourser.id}
        onCancel={() => setARembourser(null)}
        onConfirm={() => decider(aRembourser, 'refund')} />
      <ReasonDialog open={!!aContester} required={false}
        title={t('reclamationsResto.contestTitre')}
        message={t('reclamationsResto.contestTexte')}
        label={t('reclamationsResto.contestMotif')}
        placeholder={t('reclamationsResto.motifAutrePlaceholder')}
        suggestions={[t('reclamationsResto.motifSac'), t('reclamationsResto.motifLivreur')]}
        confirmLabel={t('reclamationsResto.contestEnvoyer')}
        loading={!!aContester && enCours === aContester.id}
        onCancel={() => setAContester(null)}
        onConfirm={(motif) => decider(aContester, 'contest', motif)} />
    </section>
  );
}
