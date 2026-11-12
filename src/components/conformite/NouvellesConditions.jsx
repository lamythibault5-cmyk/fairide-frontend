import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { vibrer } from '../../gestes';
import { experienceApp } from '../../natif';
import useMiseAJour from '../../miseAJour';
import { euros } from '../../prixPlat';
import EcranPlein from '../EcranPlein';
import SousEcran from '../SousEcran';
import { Langues, Option } from '../../pages/app/EcransBienvenue';
import { TexteCgv } from '../../pages/legal/Terms';
import { TexteConfidentialite } from '../../pages/legal/Privacy';
import { EVENEMENT_CONDITIONS_ACCEPTEES, exempleHausse } from '../../conformite';
import '../../nouvelles-conditions.css';

/* NOUVELLES CONDITIONS : UN ÉCRAN, UN BOUTON, ON CONTINUE (fondateur, 2026-11-06, maquettes/nouvelles-conditions, version C).
 * « Uber Eats montre un écran simple à l'ouverture quand les conditions changent : on accepte et on continue. » Remplace, comme
 * premier endroit où on le voit : la case CGU au paiement du client, la carte en tête de Commandes du commerce, la feuille
 * « Ton contrat a changé » du livreur (FeuilleTextesLivreur, 03/11). Un écran plein, à l'ouverture, pour qui avait accepté une
 * version antérieure : titre, les textes à un toucher, une phrase qui dit ce que vaut le bouton, « Accepter et continuer ».
 *
 * CE QUI LE REND VALABLE (fondateur : « make sure my decisions hold legally »).
 *   - Le bouton, libellé ainsi, avec la phrase juste au-dessus, est l'« action claire et affirmative » : la même valeur que la
 *     case + le bouton d'avant (signature électronique simple, eIDAS art. 25 ; le serveur garde l'heure, l'IP, l'empreinte).
 *   - « Je n'accepte pas » existe pour les trois rôles, et c'est voulu, pas un « Plus tard » :
 *       commerce : son contrat le promet (clause « Modification du contrat », depuis RESTO-2026.23 : tant qu'il n'a pas accepté,
 *         sa version continue, il reçoit des commandes et modifie sa carte ; la poursuite de l'activité ne vaut pas
 *         acceptation). Et le règlement P2B (art. 3 §2-3) : accepter « dès maintenant » renonce au préavis de 15 jours ; une
 *         renonciation sans autre choix que de quitter l'app ne serait pas libre, et le changement serait nul. Après le refus,
 *         la carte en tête de Commandes reste (RenouvellementContrat.jsx), comme la clause le décrit ;
 *       livreur : sans la version en vigueur, pas de course (fondateur, 31/10, serveur) ; mais ses gains, ses factures et son
 *         compte restent à lui. Après le refus, « Signe ton nouveau contrat » sur Courses, comme avant ;
 *       client : il peut regarder les commerces, ou supprimer son compte (RGPD art. 17, depuis Mon compte) sans rien
 *         accepter. Au paiement, la case revient (CheckoutConformite.jsx), le serveur refusant toute commande sans la version.
 *     Le refus vaut pour la session (sessionStorage) : l'écran revient à la prochaine ouverture, tant que ce n'est pas accepté.
 *   - La politique de confidentialité est « prise en connaissance », jamais « acceptée » : c'est une information (RGPD art. 13),
 *     pas un consentement.
 *   - Qui signe : le commerce, au nom tapé à sa dernière signature (comme le bouton de RenouvellementContrat) ; sans nom connu,
 *     le bouton mène à la page Engagements (case et nom). Le livreur, au nom de sa pièce vérifiée : le serveur le prend lui-même
 *     quand aucun nom n'est envoyé (POST /couriers/me/engagements). Jamais l'équipe en « agir pour », jamais un membre de
 *     l'équipe du commerce (staffRole « service »), jamais la simulation.
 *   - Les comptes de test, eux, le voient (fondateur, 2026-11-07 : « je veux voir si tout marche » avec son compte de test,
 *     comme un client). Rien n'y est faux : le compte accepte pour lui-même. Les comptes admin restent dehors.
 *
 * JAMAIS AU MILIEU DE QUELQUE CHOSE : pas pendant qu'une commande du client est suivie, qu'un livreur a une course en main ou
 * qu'une commande attend d'être acceptée au commerce (l'état « occupé » de miseAJour.js, le même que pour la mise à jour) ; ni
 * au paiement ; ni sur les pages où l'on lit et signe ces textes (il revient en les quittant, relu au serveur : on a pu y
 * accepter). Monté par Layout.jsx (client, livreur) et DashboardLayout.jsx (commerce, qui connaît le commerce choisi). */

const AVANT_COURSE = ['transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate', 'declaration_honneur'];
// Ce qui change, en une phrase, par version du contrat livreur (la fin de la version : « IND-v4-2026.9 » → « 2026.9 »).
// 2026.11 ne change que les montants de l'attente (le texte ne les cite pas) : même phrase que 2026.10.
const CHANGEMENTS_LIVREUR = { '2026.9': 'ecranLivreur.feuilleContrat_2026_9', '2026.10': 'ecranLivreur.feuilleContrat_2026_10', '2026.11': 'ecranLivreur.feuilleContrat_2026_10' };
const REFUS = 'fairide_conditions_refusees';
const PAGES_LIBRES = ['/cgv', '/confidentialite', '/mentions-legales', '/cookies', '/documents', '/account', '/checkout', '/order-success',
  '/dashboard/engagements', '/driver/onboarding'];

function refusees() {
  try { return JSON.parse(sessionStorage.getItem(REFUS) || '{}') || {}; } catch { return {}; }
}
function refuser(role, version) {
  try { sessionStorage.setItem(REFUS, JSON.stringify({ ...refusees(), [role]: version })); } catch { /* il reviendra, sans gravité */ }
}

// Ce qui attend, pour ce rôle : null si rien. `version` identifie ce qui est à accepter (le refus de la session vaut pour elle).
async function lire(role, { token, restoId }) {
  if (role === 'client') {
    const r = await api('/auth/terms', { token });
    // Jamais accepté (ancien compte) : la case du paiement s'en charge, comme avant. Ici, une version qui a CHANGÉ.
    if (r.accepted || !r.lastAccepted || !r.version) return null;
    return { version: r.version };
  }
  if (role === 'restaurant') {
    if (!restoId) return null;
    const [c, hausse] = await Promise.all([api(`/restaurants/${restoId}/contract`, { token }), api(`/restaurants/${restoId}/price-markup`, { token }).catch(() => null)]);
    if (!c?.acceptedAt || !c.acceptedVersion || c.acceptedVersion === c.version) return null;
    return { version: c.version, nom: String(c.acceptedName || c.responsibleName || '').trim(), sansPreavis: !!c.sansPreavis,
      changements: Array.isArray(c.changes) ? c.changes : [], hausse: exempleHausse(hausse) };
  }
  const d = await api('/couriers/me', { token });
  // Un brouillon signe son contrat dans son dossier : c'est une étape, pas une nouvelle version.
  if (!d?.courier || ['draft', 'rejected'].includes(d.courier.lifecycleStatus)) return null;
  const manques = d.missing ?? [];
  const contrat = manques.includes('contrat');
  const textes = AVANT_COURSE.filter((k) => manques.includes(k));
  if (!contrat && !textes.length) return null;
  // Les versions AFFICHÉES (audit du 19/10, courier-27) : un texte changé entre-temps est refusé (409) et l'écran relu.
  const liste = await api('/couriers/me/consents', { token }).catch(() => []);
  const versions = Object.fromEntries((Array.isArray(liste) ? liste : []).filter((x) => AVANT_COURSE.includes(x.kind)).map((x) => [x.kind, x.version]));
  const complete = String(d.contractVersions?.[d.courier.statusType] || '');
  const id = d.courier.identity || {};
  return { version: [complete, ...textes.map((k) => `${k}:${versions[k] || ''}`)].join('|'), contrat, textes: textes.length, versions,
    courte: complete.match(/(\d{4}\.\d+)$/)?.[1] || null, nom: `${id.firstName || ''} ${id.lastName || ''}`.trim() || d.user?.name || '' };
}

export default function NouvellesConditions({ role, restoId = null, nomCommerce = '', membreEquipe = false }) {
  const { token, user, actingAdminEmail } = useAuth();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { occupe } = useMiseAJour();
  const [attente, setAttente] = useState(null);
  const [refus, setRefus] = useState(false);
  const [texte, setTexte] = useState(null); // 'cgu' | 'confidentialite' : la feuille ouverte (app)
  const [voirTout, setVoirTout] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const libre = PAGES_LIBRES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const concerne = !!token && !!user && !user.isAdmin && !user.simulation && !actingAdminEmail && !membreEquipe;

  // Relu à l'ouverture et en quittant une page où l'on a pu accepter (Mes documents, Engagements, le dossier, le paiement).
  useEffect(() => {
    if (!concerne || libre) return undefined;
    let vivant = true;
    lire(role, { token, restoId }).then((a) => { if (vivant) setAttente(a && refusees()[role] !== a.version ? a : null); }).catch(() => {});
    return () => { vivant = false; };
  }, [concerne, libre, role, token, restoId]);

  if (!concerne || libre || occupe || !attente) return null;

  const fermer = () => { setAttente(null); setRefus(false); setVoirTout(false); };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(attente.version) ? new Date(`${attente.version}T12:00:00`).toLocaleDateString(locale) : attente.version;
  const commerceSansNom = role === 'restaurant' && attente.nom.length < 3;

  async function accepter() {
    if (commerceSansNom) { fermer(); navigate('/dashboard/engagements'); return; }
    vibrer();
    setEnCours(true);
    try {
      let message = t('nouvellesConditions.merci');
      if (role === 'client') {
        await api('/auth/terms/accept', { method: 'POST', token, body: { accepted: true, version: attente.version, context: 'reaccept' } });
      } else if (role === 'restaurant') {
        const r = await api(`/restaurants/${restoId}/contract/accept`, { method: 'POST', token, body: { typedName: attente.nom, readConfirmed: true, renonciationPreavis: attente.sansPreavis || undefined } });
        message = r.markupRaisedTo ? t('renouvellementContrat.toastHausse', { p: Number(r.markupRaisedTo).toLocaleString(locale, { maximumFractionDigits: 2 }) }) : t('renouvellementContrat.toast');
      } else {
        // Sans nom : le serveur signe au nom de la pièce vérifiée (sinon du compte), celui écrit au-dessus du bouton.
        await api('/couriers/me/engagements', { method: 'POST', token, body: { accepted: true, versions: attente.versions } });
        message = t('nouvellesConditions.merciLivreur');
      }
      vibrer('succes');
      toast(message, 'succes');
      fermer();
      window.dispatchEvent(new CustomEvent(EVENEMENT_CONDITIONS_ACCEPTEES, { detail: { role } }));
    } catch (e) {
      toast(e.message, 'erreur');
      // Un texte livreur changé pendant que l'écran était ouvert (409) : on relit ce qui attend.
      if (e.code === 'VERSION_PERIMEE' || e.status === 409) lire(role, { token, restoId }).then(setAttente).catch(() => {});
    } finally { setEnCours(false); }
  }

  const titre = role === 'client' ? t('nouvellesConditions.titreClient')
    : role === 'driver' && !attente.contrat ? t('ecranLivreur.feuilleTextesTitre') : t('nouvellesConditions.titreContrat');
  const sous = role === 'client' ? t('nouvellesConditions.sousClient')
    : role === 'restaurant' ? t('nouvellesConditions.sousCommerce')
      : attente.contrat ? t(CHANGEMENTS_LIVREUR[attente.courte] || 'nouvellesConditions.sousLivreur') : t('nouvellesConditions.sousLivreurTextes');
  const mention = role === 'client' ? t('nouvellesConditions.mentionClient', { date })
    : role === 'restaurant' ? t('nouvellesConditions.mentionCommerce', { version: attente.version, commerce: nomCommerce || '…', nom: attente.nom })
      // Ce que le bouton signe vraiment : le contrat, les textes d'avant la course, ou les deux (une écriture pour chacun).
      : t(!attente.contrat ? 'nouvellesConditions.mentionLivreurTextes' : attente.textes ? 'nouvellesConditions.mentionLivreurTout' : 'nouvellesConditions.mentionLivreur', { nom: attente.nom });
  const refusTexte = t(`nouvellesConditions.refus_${role}`);

  // Les textes : dans l'app, une feuille par-dessus (CgvEnFeuille.jsx) ; sur le site, un nouvel onglet ; le contrat du commerce
  // et les textes du livreur, sur leur page (où l'écran se retire, et d'où il revient relu).
  const ouvrirTexte = (quoi) => {
    if (experienceApp()) { setTexte(quoi); return; }
    window.open(quoi === 'cgu' ? '/cgv' : '/confidentialite', '_blank', 'noopener');
  };
  const liens = role === 'client' ? (
    <>
      <Option icone="document" titre={t('nouvellesConditions.lireCgu')} onClick={() => ouvrirTexte('cgu')} />
      <Option icone="cadenas" titre={t('nouvellesConditions.lireConfidentialite')} onClick={() => ouvrirTexte('confidentialite')} />
    </>
  ) : role === 'restaurant' ? (
    <>
      {attente.changements.length > 0 && (
        <Option icone="crayon" titre={voirTout ? t('renouvellementContrat.masquer') : t('renouvellementContrat.voir', { n: attente.changements.length })} onClick={() => setVoirTout(!voirTout)} />
      )}
      {voirTout && <ul className="nc-changements">{attente.changements.map((c) => <li key={c}>{c}</li>)}</ul>}
      <Option icone="document" titre={t('renouvellementContrat.lire')} onClick={() => navigate('/dashboard/engagements')} />
    </>
  ) : (
    <Option icone="document" titre={t('nouvellesConditions.lireTextesLivreur')} onClick={() => navigate('/driver/onboarding', { state: { ouvrir: 'textes' } })} />
  );

  return (
    <EcranPlein etiquette={refus ? t('nouvellesConditions.refusTitre') : titre}>
      <main className="bv-ecran nc-ecran">
        <div className="bv-haut"><div className="bv-grandit" /><Langues /></div>
        {refus ? (
          <div className="bv-form">
            <h1 className="bv-titre bv-titre-form">{t('nouvellesConditions.refusTitre')}</h1>
            <p className="bv-sous">{refusTexte}</p>
            <div className="bv-grandit" />
            <button type="button" className="bv-btn btn-gold" onClick={() => setRefus(false)}>{t('nouvellesConditions.revenir')}</button>
            <button type="button" className="bv-lien" onClick={() => { refuser(role, attente.version); fermer(); }}>{t('nouvellesConditions.continuerSans')}</button>
          </div>
        ) : (
          <div className="bv-form">
            <h1 className="bv-titre bv-titre-form">{titre}</h1>
            <p className="bv-sous">{sous}</p>
            {role === 'restaurant' && attente.hausse && (
              <p className="nc-hausse">{t('renouvellementContrat.hausse', { p: attente.hausse.p.toLocaleString(locale, { maximumFractionDigits: 2 }), affiche: euros(attente.hausse.affiche), recu: euros(attente.hausse.recu) })}</p>
            )}
            {liens}
            <div className="bv-grandit" />
            {!commerceSansNom && <p className="nc-mention">{mention}</p>}
            <button type="button" className="bv-btn btn-gold" disabled={enCours} onClick={accepter}>
              {enCours ? '…' : t(commerceSansNom ? 'nouvellesConditions.lireAccepter' : 'nouvellesConditions.bouton')}
            </button>
            <button type="button" className="bv-lien" onClick={() => setRefus(true)}>{t('nouvellesConditions.refuser')}</button>
          </div>
        )}
      </main>
      {texte === 'cgu' && <SousEcran titre={t('terms.pageTitle')} onFermer={() => setTexte(null)}><TexteCgv /></SousEcran>}
      {texte === 'confidentialite' && <SousEcran titre={t('privacy.title')} onFermer={() => setTexte(null)}><TexteConfidentialite /></SousEcran>}
    </EcranPlein>
  );
}
