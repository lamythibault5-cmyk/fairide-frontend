import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import usePageMeta from '../../hooks/usePageMeta';
import Icone from '../../components/Icone';

/* /confidentialite/confirmer/:token — CONFIRMER UNE DEMANDE RGPD DU FORMULAIRE PUBLIC (audit sécurité 2026-10-31, décision
 * d'Owen). Le formulaire de /confidentialite ne demande qu'une adresse e-mail : n'importe qui pouvait y taper celle d'un autre
 * et obtenir, par l'équipe, la suppression de son compte ou l'export de ses données. L'accusé de réception porte donc un lien
 * (jeton de 48 caractères) : tant qu'il n'est pas ouvert, la demande reste « non vérifiée » et la console refuse la
 * suppression et l'export (409 PRIVACY_NOT_VERIFIED, backend routes/adminCompliance.js).
 *
 * Le jeton part UNE fois, au chargement : la page n'a rien à remplir, le lien du courriel suffit. Le garde `envoye` évite le
 * second envoi du double montage de React en développement (StrictMode). Une coupure réseau garde un bouton « Réessayer » ;
 * un lien inconnu, déjà utilisé ou périmé (400 PRIVACY_LINK_INVALID) dit simplement qu'il n'est plus valable.
 * « vous » comme le formulaire de la page de confidentialité, dont cette page est la suite. Le préfixe de langue (/nl, /en)
 * est géré par l'historique du routeur (i18n/routing.js) : la route est la même pour les trois langues. */
export default function ConfirmerDemandeConfidentialite() {
  const { token } = useParams();
  const { t } = useLanguage();
  // Écran privé (lien à jeton) : jamais indexé.
  usePageMeta({ title: t('privacy.confirmPageTitle'), description: '', robots: 'noindex, nofollow' });
  const [etat, setEtat] = useState('attente'); // 'attente' | 'ok' | 'invalide' | 'erreur'
  const [erreur, setErreur] = useState('');
  const envoye = useRef(null);

  function confirmer() {
    setEtat('attente');
    setErreur('');
    api('/privacy/confirm', { method: 'POST', body: { token } })
      .then(() => setEtat('ok'))
      .catch((e) => {
        if (e?.code === 'PRIVACY_LINK_INVALID' || e?.status === 400 || e?.status === 404) setEtat('invalide');
        else { setErreur(e?.message || ''); setEtat('erreur'); }
      });
  }
  useEffect(() => {
    if (envoye.current === token) return;
    envoye.current = token;
    confirmer();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{t('privacy.confirmTitle')}</h2>
      {etat === 'attente' && <p className="small" aria-busy="true">{t('privacy.confirmLoading')}</p>}
      {etat === 'ok' && (
        <p className="small" role="status"><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('privacy.confirmOk')}</p>
      )}
      {etat === 'invalide' && (
        <p className="small" role="alert"><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('privacy.confirmInvalid')}</p>
      )}
      {etat === 'erreur' && (
        <>
          <p className="small" role="alert"><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{erreur || t('privacy.confirmError')}</p>
          <button type="button" className="btn-outline" onClick={confirmer}>{t('privacy.confirmRetry')}</button>
        </>
      )}
      {etat !== 'attente' && etat !== 'erreur' && (
        <p className="small" style={{ marginBottom: 0 }}><Link to="/confidentialite">{t('privacy.confirmBack')}</Link></p>
      )}
    </div>
  );
}
