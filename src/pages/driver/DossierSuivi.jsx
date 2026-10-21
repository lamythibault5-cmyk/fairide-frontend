import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import Icone from '../../components/Icone';
import SousEcran from '../../components/SousEcran';
import RouteVelo from '../../components/livreur/RouteVelo';
import { EtapeNotices } from '../../components/conformite/LivreurConformite';
import { DocumentsVente, TarifMinimum } from '../../components/conformite/EspaceVendeurLivreur';
import { AvantDeCommencer, Notifications, ChangementStatut, NumeroEntrepriseEnAttente, PiecesARemplacer, MesCourses, PiecesSejour, ConfirmerEcole } from './dossierBlocs';
import { STATUTS } from './dossierCommun';
import '../../ecran-livreur.css';

/* LE DOSSIER ENVOYÉ OU VALIDÉ, DANS L'APPLICATION (deuxième audit design, section 9 « C'est bon, tu peux rouler », approuvé par
 * le fondateur le 2026-10-19). Le brouillon avait son bandeau et sa feuille (DossierAppli.jsx, SommaireDossier) ; une fois le
 * dossier envoyé, l'app retombait sur la page du site. Désormais :
 *   - envoyé (pending_review) : « Dossier envoyé », la promesse déjà écrite ailleurs (réponse par e-mail, en général sous 2 jours
 *     ouvrés : courierOnboarding.lifecycle_pending_review_help), le vélo qui attend au bout de la route, aucun bouton lime ;
 *   - validé : « C'est bon, tu peux rouler », la date, le statut en pastille, UN bouton lime « Voir les courses », les
 *     compteurs de l'année en tuiles blanches à filet et une ligne pour le plafond du statut (l'étudiant-indépendant voit sa
 *     jauge) ;
 *   - suspendu / plafond atteint (ancien régime) : le titre le dit, avec son aide.
 * Ce qu'on peut encore lire ou changer est en lignes à filet qui ouvrent une feuille (SousEcran) : « Avant de commencer »,
 * « Changer de statut », les documents de vente (et la copie DAC7), les gains. Rien n'a disparu de l'ancienne page : mêmes
 * blocs, mêmes routes (dossierBlocs.jsx). Aucun classement, aucun objectif : les chiffres du livreur, seulement les siens. */

// Textes à accepter avant la prochaine course quand leur version change (les mêmes que l'étape « Mes engagements »).
const AVANT_COURSE = ['transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate', 'declaration_honneur'];
const euro = (n) => euros(Number(n || 0));

export default function DossierSuivi({ d, token, user, busy, action, charger, onStatutChange }) {
  const { t } = useLanguage();
  const [feuille, setFeuille] = useState(null);
  const c = d.courier; const legal = d.legal ?? {}; const th = d.thresholds ?? {};
  const manques = d.missing ?? [];
  const etat = c.lifecycleStatus;
  const valide = etat === 'approved';
  const roule = valide || etat === 'suspended' || etat === 'blocked_threshold';
  const prenom = c.identity?.firstName || (d.user?.name || user?.name || '').trim().split(/\s+/)[0];
  const locale = getLocale();
  const jour = (x) => {
    const date = new Date(x);
    return date.toLocaleDateString(locale, date.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const dateValidation = c.reviewedAt || c.statusVerifiedAt;

  let titre; let sous;
  if (valide) { titre = t('ecranLivreur.dosValideTitre'); sous = dateValidation ? t('ecranLivreur.dosValideSous', { date: jour(dateValidation) }) : t('courierOnboarding.lifecycle_approved'); }
  else if (etat === 'pending_review') { titre = t('ecranLivreur.dosEnvoyeTitre'); sous = t('ecranLivreur.dosEnvoyeSous'); }
  else if (etat === 'suspended') { titre = t('ecranLivreur.dosSuspenduTitre'); sous = t('courierOnboarding.lifecycle_suspended_help'); }
  else { titre = t(`courierOnboarding.lifecycle_${etat}`); sous = t(`courierOnboarding.lifecycle_${etat}_help`); }

  // Ce qui demande un geste du livreur (pièce refusée, numéro d'entreprise, texte changé) : le bouton « Voir les courses »
  // perd alors son lime, qui revient au geste à faire.
  const docs = d.documents ?? [];
  const piecesRefusees = docs.some((x) => x.rejectedReason && !docs.some((y) => y.docType === x.docType && !y.rejectedReason));
  const textesARelire = AVANT_COURSE.some((m) => manques.includes(m));
  // Numéro d'entreprise ou n° de TVA encore attendu après l'envoi (audit du 19/10, courier-11 : le n° de TVA aussi).
  const bceAttendu = manques.includes('bce') || manques.includes('tva_numero');
  const aAgir = piecesRefusees || textesARelire || bceAttendu || etat === 'blocked_threshold';

  const autreStatut = STATUTS.find((x) => x !== c.statusType);
  /* APRÈS LA VALIDATION, ENCORE À SA MAIN (audit du 19/10, courier-5, courier-6, courier-7) : ses courses (zone, véhicule, autres
   * plateformes, sac), son minimum et, hors EEE, son titre de séjour et sa carte professionnelle, chacun dans sa feuille. */
  const sousCourses = [c.vehicleType && t(`courierOnboarding.vehicle_${c.vehicleType}`), c.zone].filter(Boolean).join(' · ');
  const lignes = [
    roule && { cle: 'courses', titre: t('courierOnboarding.ridesTitle'), sous: sousCourses || null },
    roule && { cle: 'minimum', titre: t('conformite.minFeeTitle'), sous: c.minFeeCents > 0 ? t('ecranLivreur.dosMinimumSous', { amount: euro(c.minFeeCents / 100) }) : t('ecranLivreur.dosMinimumAucun') },
    roule && c.nationalityGroup === 'THIRD' && { cle: 'sejour', titre: t('courierOnboarding.permitsTitle'), sous: null },
    { cle: 'avant', titre: t('courierOnboarding.beforeTitle'), sous: t('ecranLivreur.dosAvantSous') },
    autreStatut && { cle: 'statut', titre: t('courierOnboarding.changeStatusTitle'), sous: t('ecranLivreur.dosChangerSous', { status: t(`courierOnboarding.status_${autreStatut}`) }) },
    roule && { cle: 'ventes', titre: t('conformite.saleDocsTitle'), sous: t('ecranLivreur.dosVentesSous') },
    roule && { cle: 'gains', to: '/driver/earnings', titre: t('nav.earnings'), sous: t('ecranLivreur.dosGainsSous') }
  ].filter(Boolean);

  const ligne = (l) => {
    const corps = (
      <>
        <span className="ecl-grow"><b>{l.titre}</b>{l.sous && <small>{l.sous}</small>}</span>
        <Icone nom="retour" taille={16} className="bv-chevron" />
      </>
    );
    return (
      <li key={l.cle}>
        {l.to ? <Link to={l.to} className="ecl-etape">{corps}</Link>
          : <button type="button" className="ecl-etape" onClick={() => setFeuille(l.cle)}>{corps}</button>}
      </li>
    );
  };

  return (
    <div className="ecl ecl-page ecl-dossier ecl-dossier-suivi">
      <section className="ecl-bandeau">
        <div className="ecl-b-haut">
          <span>{t('appli.dosLivreur')}{prenom && <> · <b>{prenom}</b></>}</span>
          {c.statusType && <span className="ecl-b-pilule">{t(`courierOnboarding.status_${c.statusType}`)}</span>}
        </div>
        <h1 className="ecl-b-titre">{titre}</h1>
        <p className="ecl-b-sous">{sous}</p>
        {/* Validé : le vélo traverse la route et saute à l'arrivée. Envoyé : il attend au bout, immobile. */}
        {valide ? <RouteVelo depart={6} position={94} saut /> : <RouteVelo position={94} pause={etat !== 'pending_review'} />}
      </section>

      <div className="ecl-feuille">
        {c.needsRenewal && <p className="ecl-note"><Icone nom="alerte" taille={18} />{t('courierOnboarding.renewalNeeded')}</p>}
        {/* Le geste qui lève le renouvellement (audit du 19/10, courier-30) : confirmer l'école et l'année académique. */}
        {roule && <ConfirmerEcole key={`ecole-${c.needsRenewal}`} d={d} t={t} token={token} busy={busy} action={action} />}
        <Notifications t={t} token={token} enFeuille />

        {valide && (
          <Link to="/driver" className={`${aAgir ? 'btn-outline' : 'btn-gold'} ecl-bouton-dossier`}>{t('ecranLivreur.dosVoirCourses')}</Link>
        )}

        {/* Ce qui reste à faire après l'envoi : mêmes blocs que sur le site (dossierBlocs.jsx). */}
        {etat === 'blocked_threshold' && (
          <p className="ecl-note"><Icone nom="alerte" taille={18} /><span>{t('courierOnboarding.blockedExplain', { year: legal.year ?? new Date().getFullYear() })}</span></p>
        )}
        {textesARelire && (
          <ul className="ecl-etapes ecl-a-faire">
            <li>
              <button type="button" className="ecl-etape" onClick={() => setFeuille('textes')}>
                <span className="ecl-rond-etape" aria-hidden="true" />
                <span className="ecl-grow"><b>{t('ecranLivreur.dosTextesTitre')}</b><small>{t('ecranLivreur.dosTextesSous')}</small></span>
                <Icone nom="retour" taille={16} className="bv-chevron" />
              </button>
            </li>
          </ul>
        )}
        <PiecesARemplacer d={d} t={t} token={token} busy={busy} action={action} />
        {bceAttendu && <NumeroEntrepriseEnAttente t={t} token={token} busy={busy} action={action} manques={manques} />}

        {(roule || Number(th.deliveries || 0) > 0) && <Compteurs d={d} t={t} />}

        <h2 className="ecl-titre-sec">{t('ecranLivreur.dosTonDossier')}</h2>
        {c.submittedAt && !valide && <p className="ecl-texte ecl-envoye-le">{t('courierOnboarding.submittedOn', { date: jour(c.submittedAt) })}</p>}
        <ul className="ecl-etapes">{lignes.map(ligne)}</ul>
        <p className="ecl-pied-legal">{t('courierOnboarding.legalFooter', { year: legal.year ?? new Date().getFullYear() })}</p>
      </div>

      {feuille === 'avant' && (
        <SousEcran titre={t('courierOnboarding.beforeTitle')} onFermer={() => setFeuille(null)}>
          <div className="ecl-dans-feuille"><AvantDeCommencer c={c} t={t} pricing={d.pricing} replie /></div>
        </SousEcran>
      )}
      {feuille === 'statut' && (
        <SousEcran titre={t('courierOnboarding.changeStatusTitle')} onFermer={() => setFeuille(null)}>
          <ChangementStatut d={d} t={t} token={token} action={action} busy={busy} enFeuille onChanged={() => { setFeuille(null); onStatutChange?.(); }} />
        </SousEcran>
      )}
      {feuille === 'courses' && (
        <SousEcran titre={t('courierOnboarding.ridesTitle')} onFermer={() => setFeuille(null)}>
          <div className="ecl-dans-feuille"><MesCourses key={`courses-${c.updatedAt}`} d={d} t={t} token={token} busy={busy} action={action} /></div>
        </SousEcran>
      )}
      {feuille === 'minimum' && (
        <SousEcran titre={t('conformite.minFeeTitle')} onFermer={() => setFeuille(null)}>
          <div className="ecl-dans-feuille"><TarifMinimum key={`min-${c.minFeeCents ?? 'aucun'}-${c.minFeePerKmCents ?? 'aucun'}`} courier={c} token={token} action={action} busy={busy} /></div>
        </SousEcran>
      )}
      {feuille === 'sejour' && (
        <SousEcran titre={t('courierOnboarding.permitsTitle')} onFermer={() => setFeuille(null)}>
          <div className="ecl-dans-feuille"><PiecesSejour d={d} t={t} token={token} busy={busy} action={action} /></div>
        </SousEcran>
      )}
      {feuille === 'ventes' && (
        <SousEcran titre={t('conformite.saleDocsTitle')} onFermer={() => setFeuille(null)}>
          <div className="ecl-dans-feuille"><DocumentsVente token={token} /></div>
        </SousEcran>
      )}
      {feuille === 'textes' && (
        <SousEcran titre={t('conformite.engagementsTitle')} onFermer={() => setFeuille(null)}>
          <div className="ecl-dans-feuille"><EtapeNotices token={token} busy={busy} action={action} onNext={() => { setFeuille(null); charger(); }} /></div>
        </SousEcran>
      )}
    </div>
  );
}

/* TES COMPTEURS DE L'ANNÉE : les chiffres du livreur, en tuiles blanches à filet (gagné cette année, courses ; le net versé
 * en plus seulement s'il diffère du brut, sinon une phrase le dit). Puis UNE ligne sur le plafond de son statut : aucun pour
 * l'indépendant ; l'étudiant-indépendant voit sa jauge (brut Fairide de l'année sur le plafond du régime avantageux, le
 * seuil sans cotisations marqué d'un trait). Montants légaux tirés de `legal` (configuration fiscale), jamais écrits ici. */
function Compteurs({ d, t }) {
  const c = d.courier; const legal = d.legal ?? {}; const th = d.thresholds ?? {};
  const annee = th.year ?? legal.year ?? new Date().getFullYear();
  const brut = Number(th.grossTotal || 0);
  const net = Number(th.netTotal ?? (brut - Number(th.withholdingTotal || 0)));
  const n = Number(th.deliveries || 0);
  const retenue = Math.round(brut * 100) !== Math.round(net * 100);
  const plafond = Number(legal.studentIndependentCeiling || 0);
  const seuil = Number(legal.studentIndependentExemption || 0);
  const etudiant = c.statusType === 'student_independent' && plafond > 0;
  const pct = (x) => `${Math.min(100, Math.max(0, (x / plafond) * 100)).toFixed(1)}%`;
  return (
    <>
      <h2 className="ecl-titre-sec">{t('ecranLivreur.dosCompteurs', { year: annee })}</h2>
      <div className="ecl-tuiles">
        <div className="ecl-tuile"><b>{euro(brut)}</b><span>{t('ecranLivreur.dosGagnes')}</span></div>
        <div className="ecl-tuile"><b>{n}</b><span>{t(n === 1 ? 'ecranLivreur.dosCourse' : 'ecranLivreur.dosCourses')}</span></div>
        {retenue && <div className="ecl-tuile"><b>{euro(net)}</b><span>{t('ecranLivreur.dosNetVerse')}</span></div>}
      </div>
      {etudiant && (
        <div className="ecl-jauge" role="img" aria-label={t('ecranLivreur.dosJaugeAria', { gross: euro(brut), ceiling: euro(plafond) })}>
          <div className="ecl-jauge-barre"><i style={{ width: pct(brut) }} />{seuil > 0 && seuil < plafond && <span className="ecl-jauge-seuil" style={{ left: pct(seuil) }} />}</div>
          <div className="ecl-jauge-libs"><span>{t('ecranLivreur.dosJauge', { gross: euro(brut) })}</span><span>{euro(plafond)}</span></div>
        </div>
      )}
      <p className="ecl-texte ecl-plafond">
        {c.statusType === 'independent' && t('ecranLivreur.dosPlafondInd')}
        {etudiant && t('ecranLivreur.dosPlafondEtu', { exemption: euro(seuil), ceiling: euro(plafond) })}
        {!retenue && <> {t('ecranLivreur.dosRienRetenu')}</>}
      </p>
    </>
  );
}
