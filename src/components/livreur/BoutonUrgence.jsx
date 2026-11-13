import { useState } from 'react';
import { api } from '../../api';
import { positionPrecise } from '../../natif';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';
import ChoixPastilles from '../ChoixPastilles';
import Icone from '../Icone';
import AppelerFairide from './AppelerFairide';

/* BOUTON D'URGENCE DU LIVREUR (comparaison avec Uber Eats, 15 oct. 2026 ; backend POST /couriers/me/sos, urgenceLivreur.js).
 *
 * Deux gestes, dans cet ordre, parce que c'est l'ordre de l'urgence : appeler le 112 (le téléphone compose, Fairide n'est
 * pas un service de secours et ne prétend pas l'être), puis prévenir l'équipe Fairide, qui reçoit qui, où et la course en
 * cours (tâche urgente, e-mail et push à l'équipe). L'écran ne promet plus « Elle va t'appeler » : il dit que l'équipe est
 * prévenue et donne le numéro de Fairide (audit du 19/10, courier-13). La position n'est lue qu'au moment de l'appui
 * sur « Prévenir l'équipe ». Rien n'est noté contre le livreur : l'alerte sert à l'aider. */
/* APRÈS UN ACCIDENT, QUOI FAIRE (Owen, 2026-11-08). L'alerte partie, l'écran ne disait plus rien : la personne choquée au
 * bord de la route ne savait pas par quoi commencer. Pour le motif « accident », les étapes dans l'ordre : le 112 si
 * quelqu'un est blessé, puis Fairride (appel ou WhatsApp, la commande déjà écrite), des photos, et l'équipe qui fait la
 * déclaration avec lui. `commande` : le numéro de la course en main, s'il y en a une. */
export default function BoutonUrgence({ token, toast, commande = null }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState('accident');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(null);
  /* L'ALERTE N'EST PAS PARTIE (revue avant GO, 13/11) : hors réseau, 429 (déjà prévenue) ou 500, il ne restait que le 112 et
   * un toast de 3 s. Le numéro et le WhatsApp de Fairride s'affichent alors aussi, sous le bouton qui permet de réessayer. */
  const [echec, setEchec] = useState(false);

  async function prevenir() {
    setEnvoi(true);
    try {
      const position = await positionPrecise();
      const r = await api('/couriers/me/sos', { method: 'POST', token, body: { motif, ...(position || {}) } });
      setEnvoye({ positionSent: !!r.positionSent, telephone: r.supportPhone || null });
    } catch (e) {
      setEchec(true);
      toast(e.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-outline" style={{ color: 'var(--red)', borderColor: 'var(--red)', minHeight: 40 }} onClick={() => { setEnvoye(null); setEchec(false); setOuvert(true); }}>
        <Icone nom="alerte" taille={16} className="icone-texte" /> {t('dashDriver.sosButton')}
      </button>
      {ouvert && (
        <SousEcran titre={t('dashDriver.sosTitle')} onFermer={() => setOuvert(false)}>
          <a href="tel:112" className="btn-danger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 'var(--radius-pill)', textDecoration: 'none', fontWeight: 700 }}>
            <Icone nom="telephone" taille={18} /> {t('dashDriver.sosCall112')}
          </a>
          <p className="small" style={{ margin: '8px 0 18px' }}>{t('dashDriver.sosCall112Help')}</p>
          {envoye ? (
            <>
              <p className="small" role="status" style={{ fontWeight: 600 }}>
                {t(envoye.positionSent ? 'dashDriver.sosSent' : 'dashDriver.sosSentNoPosition')}
              </p>
              {motif === 'accident' && (
                <>
                  <p className="small" style={{ margin: '12px 0 6px', fontWeight: 700 }}>{t('dashDriver.sosAccidentTitre')}</p>
                  <ol className="small" style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                    <li>{t('dashDriver.sosAccident1')}</li>
                    <li>{t('dashDriver.sosAccident2')}</li>
                    <li>{t('dashDriver.sosAccident3')}</li>
                    <li>{t('dashDriver.sosAccident4')}</li>
                  </ol>
                </>
              )}
              <AppelerFairide numero={envoye.telephone} commande={commande} />
            </>
          ) : (
            <>
              <span className="field-intitule">{t('dashDriver.sosWhat')}</span>
              <ChoixPastilles
                libelle={t('dashDriver.sosWhat')}
                valeur={motif}
                onChange={setMotif}
                options={['accident', 'agression', 'malaise', 'autre'].map((m) => ({ value: m, label: t(`dashDriver.sosMotif_${m}`) }))}
              />
              <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48, marginTop: 12 }} disabled={envoi} onClick={prevenir}>
                {envoi ? '…' : t('dashDriver.sosAlertTeam')}
              </button>
              <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink-soft)' }}>{t('dashDriver.sosAlertTeamHelp')}</p>
              {echec && <div style={{ marginTop: 12 }}><AppelerFairide numero={null} commande={commande} /></div>}
            </>
          )}
        </SousEcran>
      )}
    </>
  );
}
