import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Modale from '../Modale';
import '../../code-ami.css';

/* « TON CONTRAT A CHANGÉ », OÙ QU'IL OUVRE L'APPLI (fondateur, 2026-11-03, maquettes/dossier-livreur-simple, version RB). Le
 * 03/11, trois livreurs au dossier envoyé n'avaient pas vu le nouveau contrat (2026.9, 31/10) : une ligne grise dans leur
 * dossier, rien ailleurs. Une feuille, sur n'importe quel onglet livreur, tant qu'un texte à accepter avant de rouler l'attend
 * (contrat dans sa version courante, ou une notice : manques de GET /couriers/me). « Plus tard » la ferme jusqu'à la prochaine
 * ouverture de l'appli (sessionStorage) : elle revient à chaque ouverture tant que ce n'est pas signé. Pas pour un brouillon (le
 * contrat est une étape de son dossier), ni dans le dossier lui-même, qui le montre déjà en haut (DossierSuivi.jsx). « Lire et
 * signer » ouvre le dossier sur la feuille des textes (location.state.ouvrir). */
const AVANT_COURSE = ['transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate', 'declaration_honneur'];
const CLE = 'fairide_textes_livreur_plus_tard';
// Ce qui change, en une phrase, par version du contrat livreur (la fin de la version : « IND-v4-2026.9 » → « 2026.9 »).
const CHANGEMENTS = { '2026.9': 'ecranLivreur.feuilleContrat_2026_9' };

function plusTard() {
  try { return sessionStorage.getItem(CLE) === '1'; } catch { return false; }
}

export default function FeuilleTextesLivreur() {
  const { token, role, user } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [etat, setEtat] = useState(null); // { contrat: bool, version: '2026.9' | null }
  const [ferme, setFerme] = useState(plusTard);
  const actif = role === 'driver' && !!token && !user?.isAdmin && !ferme;
  useEffect(() => {
    if (!actif) return undefined;
    let vivant = true;
    api('/couriers/me', { token }).then((d) => {
      if (!vivant || !d?.courier || ['draft', 'rejected'].includes(d.courier.lifecycleStatus)) return;
      const manques = d.missing ?? [];
      const contrat = manques.includes('contrat');
      if (!contrat && !AVANT_COURSE.some((m) => manques.includes(m))) return;
      const version = String(d.contractVersions?.[d.courier.statusType] || '').match(/(\d{4}\.\d+)$/)?.[1] || null;
      setEtat({ contrat, version });
    }).catch(() => {});
    return () => { vivant = false; };
  }, [actif, token]);

  if (!actif || !etat || pathname.startsWith('/driver/onboarding')) return null;
  const fermer = () => { try { sessionStorage.setItem(CLE, '1'); } catch { /* elle reviendra, sans gravité */ } setFerme(true); };
  const lire = () => { fermer(); navigate('/driver/onboarding', { state: { ouvrir: 'textes' } }); };
  const titre = t(etat.contrat ? 'ecranLivreur.feuilleContratTitre' : 'ecranLivreur.feuilleTextesTitre');
  const phrase = etat.contrat ? t(CHANGEMENTS[etat.version] || 'ecranLivreur.feuilleContratAutre') : t('ecranLivreur.feuilleTextesSous');
  return (
    <Modale ariaLabel={titre} onFermer={fermer} classeBoite="code-ami-feuille">
      <h2 className="code-ami-titre">{titre}</h2>
      <p className="code-ami-sous">{phrase}</p>
      <button type="button" className="btn-gold code-ami-bouton" onClick={lire}>{t(etat.contrat ? 'ecranLivreur.dosLireSigner' : 'ecranLivreur.dosLireAccepter')}</button>
      <button type="button" className="code-ami-lien" onClick={fermer}>{t('ecranLivreur.feuillePlusTard')}</button>
    </Modale>
  );
}
