import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import LigneCompte from '../LigneCompte';
import useMiseEnLigne from './useMiseEnLigne';
import { CocheTrait, VeloMarque } from './BandeauCommerce';
import Icone from '../Icone';

/* « AVANT D'ÊTRE EN LIGNE » : UNE SEULE LISTE, UN SEUL PROCHAIN BOUTON (audit UX du 15/10/2026).
 *
 * Ce qui restait à faire avant d'être vu des clients était éparpillé en quatre endroits : la carte d'état en tête du
 * tableau de bord (validation, visibilité, Stripe), le bandeau « Ta carte attend ta validation » (CarteAValider), la
 * liste de MenuReadiness sur la page Ma carte, et « Ma carte et mes engagements » (ConformiteCarte). La même carte se
 * validait de trois façons, et la liste de Ma carte se disait « prête » sans la signature ni la validation de l'équipe.
 * Un restaurateur testeur ne savait plus ce qui restait. Ici, dans l'ordre où ça se passe :
 *
 *   1. la carte existe (sinon : l'envoyer à Fairide ; ou Fairide la prépare, on attend) ;
 *   2. la carte est validée par le commerce (« C'est bon » : la signature vaut confirmation, carteSignee.signer) ;
 *   3. contrat, procédure allergènes et déclaration professionnelle signés (bloquent l'approbation, admin.js) ;
 *   4. les paiements Stripe, seulement si le commerce encaisse en ligne (formules.paiementsRequis côté serveur) ;
 *   5. la vérification par l'équipe (adminStatus) — rien à faire pour le commerce, on dit ce qui est vérifié ;
 *   6. la mise en ligne par l'équipe (publicListed).
 *
 * UN SEUL bouton plein : la première étape qui dépend du commerce. Les autres étapes à faire gardent un bouton discret,
 * les étapes de Fairide n'en ont pas (« on te prévient par e-mail »). Sur les autres pages du tableau de bord :
 * une rangée « Prochaine étape », et rien du tout s'il ne reste que des étapes de Fairide.
 * La liste disparaît quand tout est fait. Un commerce de démonstration n'en a pas.
 *
 * NOUVEAU STYLE (fondateur, 2026-10-16, mockups/tous-les-ecrans.html, Commerce › Mon commerce) : sur « Mon commerce », la
 * liste devient une ROUTE sur le bandeau iris (RouteMiseEnLigne : coches lime derrière, le vélo sur l'étape en cours) ; la
 * prochaine étape a la carte et le bouton lime, le reste se range dessous (EtapesMiseEnLigne). Le calcul est dans
 * useMiseEnLigne, appelé une fois par EditPage pour les deux morceaux ; le composant par défaut est la rangée « Prochaine étape »
 * des autres pages, inchangée. */
// Le bouton d'une étape : lime pour la prochaine, contour pour les autres.
function bouton(e, principal) {
  const classe = `${principal ? 'btn-gold' : 'btn-outline'} btn-sm`;
  if (e.action.to) return <Link to={e.action.to} className={classe} style={{ display: 'inline-block' }}>{e.action.libelle}</Link>;
  return <button type="button" className={classe} onClick={e.action.onClick} disabled={e.action.disabled}>{e.action.libelle}</button>;
}

export default function MiseEnLigne(props) {
  const { t } = useLanguage();
  const etat = useMiseEnLigne(props);
  if (!etat?.prochaine) return null;
  const { restantes, prochaine } = etat;
  // Sur le bandeau iris de Commandes (site, 2026-10-16) : une ligne claire et un bouton blanc — le lime de la page est à
  // « Accepter ». Même étape, même action.
  if (props.surBandeau) {
    const a = prochaine.action;
    return (
      <div className="sp-b-etape">
        <span className="sp-b-etape-texte"><Icone nom={prochaine.icone} taille={18} /><span><b>{t('miseEnLigne.nextStep', { step: prochaine.titre })}</b>{' · '}{t('miseEnLigne.remaining', { n: restantes.length })}</span></span>
        {a.to ? <Link to={a.to} className="sp-puce sp-puce--blanche">{a.libelle}</Link>
          : <button type="button" className="sp-puce sp-puce--blanche" onClick={a.onClick} disabled={a.disabled}>{a.libelle}</button>}
      </div>
    );
  }
  return (
    <div className="card account-groupe" aria-label={t('miseEnLigne.title')}>
      <LigneCompte icone={prochaine.icone} accent="warn" titre={t('miseEnLigne.nextStep', { step: prochaine.titre })}
        sous={t('miseEnLigne.remaining', { n: restantes.length })} action={bouton(prochaine, true)} />
    </div>
  );
}

// La route sur le bandeau : un arrêt par étape, coche lime sur chaque étape faite, le vélo sur la première qui reste. Il part
// du début et roule jusqu'à elle à l'arrivée sur la page (transition CSS sur `left`).
const posArret = (k, n) => (n > 1 ? 6 + (88 * k) / (n - 1) : 50);
// `libelles` (site) : le nom court de chaque arrêt sous la route (sitePro.etape_<cle>), masqué quand la place manque.
export function RouteMiseEnLigne({ etapes, libelles = false }) {
  const { t } = useLanguage();
  const n = etapes.length;
  const actuel = Math.max(0, etapes.findIndex((e) => !e.fait));
  const [parti, setParti] = useState(false);
  const [roule, setRoule] = useState(false);
  useEffect(() => {
    let a = requestAnimationFrame(() => { a = requestAnimationFrame(() => { setParti(true); setRoule(true); }); });
    const f = setTimeout(() => setRoule(false), 1300);
    return () => { cancelAnimationFrame(a); clearTimeout(f); };
  }, []);
  const cible = parti ? posArret(actuel, n) : posArret(0, n);
  return (
    <div className="ec-route" aria-hidden="true">
      <span className="ec-route-voie" />
      <i className="ec-route-fait" style={{ width: `${cible - 6}%` }} />
      {etapes.map((e, k) => (
        <span key={e.cle} className={`ec-route-arret${e.fait ? ' fait' : k === actuel ? ' actuel' : ''}`} style={{ left: `${posArret(k, n)}%`, animationDelay: `${0.25 + k * 0.12}s` }}>
          {e.fait && <CocheTrait />}
        </span>
      ))}
      <span className={`ec-route-velo${roule ? ' roule' : ''}`} style={{ left: `${cible}%` }}><VeloMarque /></span>
      {libelles && (
        <span className="sp-route-libs">
          {etapes.map((e, k) => (
            <span key={e.cle} className={e.fait ? 'fait' : k === actuel ? 'actuel' : undefined} style={{ left: `${posArret(k, n)}%` }}>{t(`sitePro.etape_${e.cle}`)}</span>
          ))}
        </span>
      )}
    </div>
  );
}

// Dans la feuille : la prochaine étape en carte avec LE bouton lime, puis les autres (coche lime, en cours, à faire avec un
// bouton discret). Sans prochaine étape (il ne reste que des étapes de Fairide, ou « agir pour ») : on le dit, sans bouton.
// `boutonDansCarte` (site) : le bouton lime dans la carte de la prochaine étape, à droite, au lieu de pleine largeur dessous.
export function EtapesMiseEnLigne({ etat, boutonDansCarte = false }) {
  const { t } = useLanguage();
  const { etapes, prochaine } = etat;
  const p = prochaine;
  const boutonLime = p?.action && (p.action.to
    ? <Link to={p.action.to} className="ec-bouton ec-bouton--lime">{p.action.libelle}</Link>
    : <button type="button" className="ec-bouton ec-bouton--lime" onClick={p.action.onClick} disabled={p.action.disabled}>{p.action.libelle}</button>);
  return (
    <section aria-label={t('miseEnLigne.title')}>
      <div className={`ec-prochaine${boutonDansCarte ? ' sp-prochaine' : ''}`}>
        <span className="ec-tuile"><Icone nom={p ? p.icone : 'horloge'} taille={20} /></span>
        <span className="ec-prochaine-texte">
          <small>{t('ecranCommerce.prochaineEtape')}</small>
          <b>{p ? p.titre : t('ecranCommerce.rienAFaire')}</b>
          {p?.sous && <span>{p.sous}</span>}
        </span>
        {boutonDansCarte && boutonLime}
      </div>
      {!boutonDansCarte && boutonLime}
      <div className="ec-etapes">
        {etapes.filter((e) => e !== p).map((e) => (
          <div key={e.cle} className="ec-etape">
            {e.fait ? <span className="ec-coche"><CocheTrait taille={13} /></span> : <span className="ec-tuile"><Icone nom={e.icone} taille={16} /></span>}
            <span className="ec-etape-texte">
              {e.titre}{e.sous && <small>{e.sous}</small>}
              {e.action && <span className="ec-etape-action">{bouton(e, false)}</span>}
            </span>
            {!e.action && <span className={`ec-badge${e.fait ? '' : ' ec-badge--doux'}`}>{t(e.fait ? 'miseEnLigne.done' : e.attente ? 'miseEnLigne.waiting' : 'miseEnLigne.toDo')}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
