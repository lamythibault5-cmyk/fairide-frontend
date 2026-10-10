import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import ConfirmDialog from '../ConfirmDialog';
import { ATTENTE_PORTE_MIN, APPELS_CLIENT_MIN } from '../../conformite';

// Incidents d'une course, côté livreur (plan de test de bout en bout, 2 octobre 2026) — voir « INCIDENTS DE LIVRAISON »
// dans routes/orders.js côté serveur :
//   - avant le retrait : « J'attends au commerce » (LIV-8) et « Annuler la course » (LIV-2, sans aucune conséquence).
//     Appelé « Rendre la course » jusqu'au 10 oct. 2026 — pas clair pour les livreurs testés. On ne l'interdit pas : la
//     liberté de refuser et d'organiser son travail compte parmi les critères de l'art. 337/3 (présomption de salariat).
//     On le rend seulement rare par le texte (« si tu peux encore la faire, garde-la »), jamais par une conséquence ;
//   - en livraison : « Client injoignable » (LIV-5, commande sans alcool : attente de 10 min puis clôture) et
//     « Je ne peux pas terminer » (LIV-2 après retrait : l'équipe est alertée et appelle).
// Rien de ceci n'est lu pour classer ou pénaliser le livreur ; les libellés le disent.
export default function IncidentsCourse({ order, token, toast, onChange }) {
  const { t } = useLanguage();
  const [confirmer, setConfirmer] = useState(null); // 'rendre' | 'bloque' | 'absent'
  const [enCours, setEnCours] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setMaintenant(Date.now()), 15000); return () => clearInterval(id); }, []);

  async function appeler(chemin, body = {}) {
    setEnCours(true);
    try {
      const r = await api(`/orders/${order.id}/${chemin}`, { method: 'PATCH', token, body });
      if (r?.message) toast(r.message);
      await onChange?.();
      return r;
    } catch (e) {
      toast(e.message, 'erreur');
      return null;
    } finally {
      setEnCours(false); setConfirmer(null);
    }
  }

  const avantRetrait = ['preparation', 'pret'].includes(order.status);
  const enLivraison = order.status === 'livraison';
  const attenteMin = order.courierWaitingSince ? Math.max(0, Math.floor((maintenant - order.courierWaitingSince) / 60000)) : null;
  const finAttenteClient = order.clientAbsentReportedAt ? order.clientAbsentReportedAt + ATTENTE_PORTE_MIN * 60000 : null;
  const resteClient = finAttenteClient ? Math.max(0, Math.ceil((finAttenteClient - maintenant) / 60000)) : null;
  const appels = order.clientCallAttempts || 0;
  const peutClore = resteClient === 0 && (!order.clientPhone || appels >= APPELS_CLIENT_MIN);

  // Compte l'appel côté serveur PUIS ouvre le téléphone. Si le serveur ne répond pas, on appelle quand même : joindre
  // le client passe avant la trace.
  async function appelerClient() {
    try { await api(`/orders/${order.id}/call-client`, { method: 'PATCH', token }); } catch { /* l'appel part quand même */ }
    window.location.href = `tel:${order.clientPhone}`;
    onChange?.();
  }

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {avantRetrait && (attenteMin === null
        ? <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} disabled={enCours} onClick={() => appeler('waiting')}>{t('dashDriver.incident_waiting')}</button>
        : <span className="small">{t('dashDriver.incident_waitingSince', { min: attenteMin })}</span>)}
      {avantRetrait && <button type="button" className="btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} disabled={enCours} onClick={() => setConfirmer('rendre')}>{t('dashDriver.incident_release')}</button>}
      {enLivraison && !order.containsAlcohol && resteClient === null && (
        <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} disabled={enCours} onClick={() => appeler('client-absent')}>{t('dashDriver.incident_clientAbsent')}</button>
      )}
      {/* CLIENT ABSENT (fondateur, 10 oct. 2026) : le client est prévenu (e-mail + bandeau sur son suivi), le livreur
          attend ATTENTE_PORTE_MIN minutes ET l'appelle au moins deux fois. Les appels passent par ce bouton, qui les
          compte côté serveur (PATCH /call-client) avant d'ouvrir le téléphone : c'est la trace qui protège le livreur
          si le client conteste. Sans numéro connu, l'attente suffit. Ensuite seulement, « Clore : client absent ». */}
      {enLivraison && !order.containsAlcohol && resteClient !== null && (
        <div style={{ width: '100%' }}>
          <p className="small" style={{ margin: '0 0 6px' }}>
            {resteClient > 0 ? t('dashDriver.incident_clientWarned', { min: resteClient }) : t('dashDriver.incident_waitOver')}
            {order.clientPhone ? ` ${t('dashDriver.incident_callsDone', { n: appels, min: APPELS_CLIENT_MIN })}` : ''}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {order.clientPhone && (
              <button type="button" className="btn-teal" style={{ padding: '10px 16px', fontSize: 14 }} disabled={enCours} onClick={appelerClient}>
                📞 {t('dashDriver.incident_callClient')}
              </button>
            )}
            {peutClore && (
              <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} disabled={enCours} onClick={() => setConfirmer('absent')}>{t('dashDriver.incident_closeAbsent')}</button>
            )}
          </div>
        </div>
      )}
      {enLivraison && <button type="button" className="btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} disabled={enCours} onClick={() => setConfirmer('bloque')}>{t('dashDriver.incident_cannotFinish')}</button>}
      <ConfirmDialog
        open={!!confirmer}
        title={confirmer === 'rendre' ? t('dashDriver.incident_releaseTitle') : confirmer === 'absent' ? t('dashDriver.incident_closeAbsentTitle') : t('dashDriver.incident_cannotFinishTitle')}
        message={confirmer === 'rendre' ? t('dashDriver.incident_releaseText') : confirmer === 'absent' ? t('dashDriver.incident_closeAbsentText') : t('dashDriver.incident_cannotFinishText')}
        confirmLabel={confirmer === 'rendre' ? t('dashDriver.incident_release') : confirmer === 'absent' ? t('dashDriver.incident_closeAbsent') : t('dashDriver.incident_cannotFinish')}
        loading={enCours}
        onCancel={() => setConfirmer(null)}
        onConfirm={() => (confirmer === 'absent' ? appeler('client-absent', { confirm: true }) : appeler('release'))}
      />
    </div>
  );
}
