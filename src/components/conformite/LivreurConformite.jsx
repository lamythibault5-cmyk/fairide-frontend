import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import Modale from '../Modale';

/* Informations et consentements du livreur (backlog de conformité du 23/09/2026).
 *
 *   B4 — notice des systèmes automatisés et politique de géolocalisation, remises AVANT la première
 *        course et de nouveau à chaque modification (leur version change avec leur texte : voir
 *        fairide-backend/consentementsLivreur.js). Tant qu'elles ne sont pas acceptées dans leur
 *        version courante, le serveur refuse la prise de course (NOTICES_A_ACCEPTER).
 *   B8 — information DAC7, dans la même étape.
 *   G2 — mandat d'autofacturation (décision du 23/09/2026) : le livreur vend la livraison, Fairide émet
 *        ses documents de vente en son nom. Il doit figurer ici : le serveur l'exige avant la première
 *        course (consentementsLivreur.AVANT_PREMIERE_COURSE), l'omettre bloquerait le livreur sans
 *        qu'il puisse voir ce qu'on lui demande.
 *   B1 — consentement biométrique, SÉPARÉ, demandé seulement au moment de lancer Stripe Identity ;
 *        la vérification manuelle reste proposée à côté, sans condition. */
const AVANT_COURSE = ['transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate', 'declaration_honneur'];

/* UNE CASE POUR TOUT (fondateur, 12 oct. 2026 : « que des cases à cocher, simple et minimaliste »). Les informations
 * à lire avant la première course, le mandat d'autofacturation, la déclaration sur l'honneur (qui remplace les pièces
 * de statut et de véhicule) et — pendant l'inscription — le contrat du statut : tous les textes restent lisibles, repliés,
 * puis UNE case, le nom prérempli, UN bouton (POST /couriers/me/engagements). Côté serveur, chaque texte garde sa
 * propre acceptation (version, empreinte, IP). Le consentement biométrique reste à part (RGPD art. 9).
 * `contrat` : { aSigner, nom, onApercu } pendant le dossier ; absent pour un livreur validé qui relit un texte changé. */
export function EtapeNotices({ token, busy, action, onNext, contrat = null }) {
  const { t } = useLanguage();
  const [liste, setListe] = useState(null);
  const [coche, setCoche] = useState(false);
  const [nom, setNom] = useState(contrat?.nom || '');
  const charger = () => api('/couriers/me/consents', { token }).then(setListe).catch(() => setListe([]));
  useEffect(() => { charger(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!liste) return <div className="card"><p className="small">…</p></div>;
  const reste = liste.filter((c) => AVANT_COURSE.includes(c.kind) && !c.accepted);
  const contratASigner = !!contrat?.aSigner;
  const toutAccepte = !reste.length && !contratASigner;

  async function accepter() {
    const ok = await action(() => api('/couriers/me/engagements', { method: 'POST', token, body: { accepted: true, typedName: nom.trim() } }), t('conformite.engagementsAcceptedToast'));
    if (ok) { await charger(); onNext?.(); }
  }

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('conformite.engagementsTitle')}</h3>
      {toutAccepte ? (
        <p className="small" style={{ margin: 0 }}>✓ {t('conformite.engagementsDone')}</p>
      ) : (
        <>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('conformite.engagementsHelp')}</p>
          {reste.map((c) => (
            <details key={c.kind} className="notice-livreur">
              <summary>{c.title}</summary>
              {/* Texte rendu tel quel : c'est sa version exacte (et son empreinte) qui est enregistrée. */}
              <div className="small notice-texte" style={{ whiteSpace: 'pre-wrap', margin: '8px 0' }}>{c.text}</div>
            </details>
          ))}
          {contratASigner && (
            <p className="small" style={{ margin: '6px 0' }}>
              <button type="button" className="lien-bouton" onClick={contrat.onApercu}>📄 {t('conformite.engagementsReadContract')}</button>
            </p>
          )}
          <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginTop: 10 }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={coche} onChange={(e) => setCoche(e.target.checked)} />
            <span className="small" style={{ fontWeight: 600 }}>{contratASigner ? t('conformite.engagementsCheckWithContract') : t('conformite.engagementsCheck')}</span>
          </label>
          {contratASigner && (
            <div className="field" style={{ margin: '8px 0 0', maxWidth: 280 }}>
              <label htmlFor="engagements-nom" className="small">{t('courierOnboarding.typedName')}</label>
              <input id="engagements-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" />
            </div>
          )}
          <button type="button" className="btn-gold" style={{ marginTop: 10 }} disabled={busy || !coche || (contratASigner && nom.trim().length < 3)} onClick={accepter}>
            {busy ? '…' : t('conformite.engagementsButton')}
          </button>
        </>
      )}
      {toutAccepte && onNext && <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn-gold" onClick={onNext}>{t('courierOnboarding.next')}</button></div>}
    </div>
  );
}

// Fenêtre du consentement biométrique : affiche le texte exact renvoyé par le serveur (428), et relance
// Stripe Identity une fois accepté. `onManuel` : l'alternative, toujours à portée de main.
export function ConsentementBiometrique({ consent, token, onAccepte, onManuel, onFermer }) {
  const { t } = useLanguage();
  const [coche, setCoche] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  if (!consent) return null;
  async function accepter() {
    setEnvoi(true); setErreur(null);
    try {
      await api('/couriers/me/consents', { method: 'POST', token, body: { kind: consent.kind, version: consent.version, accepted: true } });
      onAccepte();
    } catch (e) { setErreur(e.message); } finally { setEnvoi(false); }
  }
  return (
    <Modale titre={consent.title} largeur={520} onFermer={onFermer}>
      <div className="small" style={{ whiteSpace: 'pre-wrap', margin: '0 0 12px' }}>{consent.text}</div>
      <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '0 0 12px' }}>
        <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={coche} onChange={(e) => setCoche(e.target.checked)} />
        <span className="small">{t('conformite.biometricConsentCheck')}</span>
      </label>
      {erreur && <p className="small" style={{ color: 'var(--red)' }}>{erreur}</p>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="btn-outline" disabled={envoi} onClick={onManuel}>{t('conformite.biometricChooseManual')}</button>
        <button type="button" className="btn-teal" disabled={envoi || !coche} onClick={accepter}>{envoi ? '…' : t('conformite.biometricAccept')}</button>
      </div>
    </Modale>
  );
}
