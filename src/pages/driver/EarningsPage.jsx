import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import EtatVide from '../../components/EtatVide';
import ChiffresRoulants from '../../components/ChiffresRoulants';
import RouteVelo from '../../components/livreur/RouteVelo';
import Icone from '../../components/Icone';
import SousEcran from '../../components/SousEcran';
import CopieDac7 from '../../components/conformite/CopieDac7';
import { experienceApp } from '../../natif';
import { vibrer } from '../../gestes';
import '../../ecran-livreur.css';
import '../../site-livreur.css';

// « Mes gains » (livreur) : ce que Fairide a versé sur l'année (/couriers/me/earnings), par semaine et par course, avec les
// règles du statut. Aucun chiffre légal n'est écrit ici : tout vient de `legal` (/couriers/me).
// Cette page n'affiche ni classement, ni objectif, ni cadence : elle rend compte, elle n'impose rien.
//
// DES GAINS QUI SE LISENT COMME DE L'ARGENT (deuxième audit design, section 10, approuvé par le fondateur le 2026-10-19).
// Avant : « Net versé 214,60 € » et « Brut 214,60 € » côte à côte sans explication, douze mois dont dix vides pour qui a
// commencé en octobre, et des lignes « #1709529c · Indépendant » où le pourboire était une ligne à part. Maintenant :
//   - le bandeau dit « Gains · année », UN grand total (le net, ce qui est versé) et « N courses · Fairide ne retient rien »
//     quand net = brut ; s'ils diffèrent (une retenue d'un ancien régime), le brut et la retenue, et une phrase qui l'explique ;
//   - une barre par SEMAINE depuis la première semaine où le livreur a gagné quelque chose (`byWeek`, backend gainsLivreur.js) ;
//     toucher une barre montre sa semaine ; la bulle s'aligne à gauche, au centre ou à droite selon la barre (avant, seules la
//     première et la dernière étaient retenues, les autres dépassaient de 12 px hors de l'écran) ;
//   - une ligne par course, groupées par jour : « commerce → commune », heure · distance, le montant, « + pourboire » en gris
//     (`rides`, le pourboire replié sur sa course ; 100 % au livreur) ;
//   - le texte fiscal du statut, les deux règles (90 % de la grille, 100 % des pourboires), la copie DAC7 et les relevés
//     passent derrière une ligne « Ta fiscalité ».
// Un serveur d'avant (sans `byWeek` ni `rides`) : les mois et les écritures, comme avant.
//
// SUR LE SITE, SUR UN ORDINATEUR (mockups/site-ordinateur.html, 2026-10-16) : le graphique à gauche, les courses à droite
// (site-livreur.css). Les deux enveloppes .ecl-site-col n'ont pas de boîte ailleurs : l'app et le téléphone gardent leur
// colonne unique.
const PREMIERE_ANNEE = 2026;
const deux = (n) => Number(n || 0).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro = (n) => `${deux(n)} €`;
const km = (n) => `${Number(n).toLocaleString(getLocale(), { maximumFractionDigits: 1 })} km`;
const pctTexte = (x) => (x == null || x === '' ? '—' : `${(Number(x) * 100).toLocaleString(getLocale(), { maximumFractionDigits: 2 })} %`);
const memeJour = (a, b) => a.toDateString() === b.toDateString();

export default function EarningsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [gains, setGains] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [barreMontree, setBarreMontree] = useState(null);
  const [fiscalite, setFiscalite] = useState(false);
  // Le dernier total affiché : pendant le chargement d'une autre année, il reste en place, puis seuls les chiffres qui
  // changent roulent.
  const [netAffiche, setNetAffiche] = useState(null);
  const annees = useMemo(() => { const a = new Date().getFullYear(); const l = []; for (let y = a; y >= Math.min(a, PREMIERE_ANNEE); y--) l.push(y); return l; }, []);

  useEffect(() => { api('/couriers/me', { token }).then(setDossier).catch(() => setDossier({})); }, [token]);
  useEffect(() => {
    setGains(null);
    setBarreMontree(null);
    api(`/couriers/me/earnings?year=${annee}`, { token }).then(setGains).catch((e) => { toast(e.message, 'erreur'); setGains({ year: annee, totals: {}, byMonth: [], lines: [], ceiling: null }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, annee]);
  useEffect(() => { if (gains) setNetAffiche(euro(gains.totals?.net)); }, [gains]);

  const legal = dossier?.legal ?? {};
  const statut = dossier?.courier?.statusType;
  const totaux = gains?.totals ?? {};
  const locale = getLocale();
  const nbCourses = totaux.deliveries ?? 0;
  const retenueTotale = Number(totaux.withholding || 0);
  const coursesTxt = (n) => (n === 1 ? t('ecranLivreur.gainsUneCourse') : t('ecranLivreur.gainsCourses', { n }));

  // Les barres : par semaine si le serveur les donne, sinon par mois (serveur d'avant).
  const parSemaine = Array.isArray(gains?.byWeek);
  const maintenant = new Date();
  const barres = useMemo(() => {
    if (!gains) return [];
    if (parSemaine) {
      return gains.byWeek.map((w) => {
        const debut = new Date(`${w.week}T12:00:00`);
        return { cle: w.week, ...w, debut, nom: t('ecranLivreur.gainsSemaineDu', { date: debut.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) }) };
      });
    }
    return (gains.byMonth ?? []).map((m) => ({ cle: String(m.month), ...m, nom: new Date(annee, Number(m.month) - 1, 1).toLocaleDateString(locale, { month: 'long' }) }));
  }, [gains, parSemaine, annee, locale, t]);
  const maxBarre = Math.max(0, ...barres.map((b) => Number(b.net || 0)));
  const auMoinsUnGain = barres.some((b) => Number(b.net || 0) !== 0);
  // Les libellés sous les barres : six au plus (le premier, puis un tous les `pas`), « 6 oct » quand le mois change, sinon le
  // jour ; la semaine en cours se lit « cette sem. ».
  const libelles = useMemo(() => {
    const out = new Map();
    if (!parSemaine) { barres.forEach((b) => out.set(b.cle, new Date(annee, Number(b.month) - 1, 1).toLocaleDateString(locale, { month: 'short' }))); return out; }
    const n = barres.length;
    if (!n) return out;
    const pas = Math.max(1, Math.ceil(n / 6));
    const rangs = [];
    for (let k = 0; k < n; k += pas) rangs.push(k);
    // La dernière barre a toujours son libellé ; trop près du précédent, elle le remplace.
    if (rangs.at(-1) !== n - 1) { if (rangs.length > 1 && n - 1 - rangs.at(-1) < pas * 0.6) rangs.pop(); rangs.push(n - 1); }
    const lundiCourant = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - ((maintenant.getDay() + 6) % 7), 12);
    rangs.forEach((k, i) => {
      const b = barres[k];
      if (k === n - 1 && memeJour(b.debut, lundiCourant)) { out.set(b.cle, t('ecranLivreur.gainsCetteSemaine')); return; }
      const nouveauMois = i === 0 || barres[rangs[i - 1]].debut.getMonth() !== b.debut.getMonth();
      out.set(b.cle, nouveauMois ? b.debut.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '') : String(b.debut.getDate()));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barres, parSemaine, annee, locale, t]);
  // Ce que dit une barre touchée : sa période, le net et le nombre de courses ; le brut et la retenue quand il y en a une.
  const bulle = (b) => {
    const n = b.deliveries ?? 0;
    const base = n === 1 ? t('ecranLivreur.bulleUne', { net: euro(b.net) }) : t('ecranLivreur.bulle', { net: euro(b.net), n });
    const retenue = Number(b.withholding || 0) !== 0 ? ` · ${t('driverPay.gross')} ${euro(b.gross)} · ${t('driverPay.withholding')} ${euro(b.withholding)}` : '';
    return `${b.nom} · ${base}${retenue}`;
  };
  // Un tiers des barres de chaque côté : la bulle part du bord de sa barre vers l'intérieur du graphique.
  const cote = (k) => (k < barres.length / 3 ? ' g' : k >= (barres.length * 2) / 3 ? ' d' : '');

  // Une ligne par course (le pourboire replié), groupées par jour, du plus récent au plus ancien.
  // Serveur d'avant (pas de `rides`) : le même repliage ici, sur les écritures.
  const replier = (lignes) => {
    const courseDe = new Set(lignes.filter((l) => l.kind === 'delivery' && l.orderId).map((l) => l.orderId));
    return lignes.filter((l) => !(l.kind === 'tip' && courseDe.has(l.orderId)))
      .map((l) => ({ ...l, tip: l.kind === 'delivery' ? lignes.filter((x) => x.kind === 'tip' && x.orderId === l.orderId).reduce((a, x) => a + Number(x.net || 0), 0) : 0 }));
  };
  const courses = gains ? (Array.isArray(gains.rides) ? gains.rides : replier(gains.lines ?? [])) : [];
  const jours = [];
  for (const r of courses) {
    const quand = r.earnedAt ? new Date(r.earnedAt) : null;
    const cle = quand ? quand.toDateString() : '-';
    let j = jours.find((x) => x.cle === cle);
    if (!j) { j = { cle, quand, lignes: [] }; jours.push(j); }
    j.lignes.push(r);
  }
  const hier = new Date(maintenant.getTime() - 86400000);
  const titreJour = (q) => (!q ? '-' : memeJour(q, maintenant) ? t('ecranLivreur.gainsAujourdhui') : memeJour(q, hier) ? t('ecranLivreur.gainsHier')
    : q.toLocaleDateString(locale, q.getFullYear() === maintenant.getFullYear() ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }));

  const ligneCourse = (r) => {
    const quand = r.earnedAt ? new Date(r.earnedAt) : null;
    const lieu = r.restaurantName ? (r.commune ? `${r.restaurantName} → ${r.commune}` : r.restaurantName) : null;
    const nature = ['delivery', 'tip', 'reversal', 'correction'].includes(r.kind) ? t(`driverPay.kind_${r.kind}`) : r.kind;
    const titre = r.kind === 'delivery' ? (lieu || `${nature} #${String(r.orderId || '').slice(0, 8)}`) : [nature, r.restaurantName].filter(Boolean).join(' · ');
    const retenue = Number(r.withholding || 0) !== 0 ? `${t('driverPay.gross')} ${euro(r.gross)} · ${t('driverPay.withholding')} ${euro(r.withholding)}${r.withholdingRate ? ` (${pctTexte(r.withholdingRate)})` : ''}` : null;
    const sous = [quand && quand.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }), r.distanceKm != null && r.kind === 'delivery' ? km(r.distanceKm) : null, retenue].filter(Boolean).join(' · ');
    const net = Number(r.net || 0);
    const tip = Number(r.tip || 0);
    return (
      <div className="ecl-gain" key={r.id}>
        <span className="ecl-grow"><b>{titre}</b>{sous && <small>{sous}</small>}</span>
        <span className="ecl-gain-montant" aria-label={tip > 0 ? t('ecranLivreur.gainsAvecPourboire', { amount: euro(net), tip: euro(tip) }) : undefined}>
          <b className={net < 0 ? 'negatif' : undefined}>{euro(net)}</b>
          {tip > 0 && <small aria-hidden="true">{t('ecranLivreur.gainsPlusPourboire', { tip: deux(tip) })}</small>}
        </span>
      </div>
    );
  };

  function choisirAnnee(y) {
    if (y === annee) return;
    if (experienceApp()) vibrer(8);
    setAnnee(y);
  }

  const aide = statut === 'student_independent' ? t('driverPay.help_student_independent')
    : statut === 'independent' ? t('driverPay.help_independent', { rate: pctTexte(legal.independentSocialRate) }) : null;
  const sousBandeau = !gains ? t('driverPay.intro')
    : retenueTotale !== 0 ? `${t('ecranLivreur.gainsBrutRetenue', { gross: euro(totaux.gross), withholding: euro(retenueTotale) })} · ${coursesTxt(nbCourses)}`
      : nbCourses === 0 ? t('ecranLivreur.gainsAucune')
        : t('ecranLivreur.gainsRienRetenu', { courses: coursesTxt(nbCourses) });

  const lignesBas = (
    <ul className="ecl-etapes ecl-gains-rangees">
      <li>
        <button type="button" className="ecl-etape" onClick={() => setFiscalite(true)}>
          <span className="ecl-grow"><b>{t('ecranLivreur.gainsFiscalite')}</b><small>{statut ? t('ecranLivreur.gainsFiscaliteSous', { status: t(`courierOnboarding.status_${statut}`) }) : t('ecranLivreur.gainsFiscaliteSousSans')}</small></span>
          <Icone nom="retour" taille={16} className="bv-chevron" />
        </button>
      </li>
    </ul>
  );

  return (
    <div className="ecl ecl-gains">
      <section className="ecl-bandeau">
        <div className="ecl-b-haut">
          <h1 className="ecl-b-ctx"><b>{t('nav.earnings')}</b> · {annee}</h1>
          {/* Le choix de l'année n'apparaît qu'à partir de la deuxième année d'activité de Fairide. */}
          {annees.length > 1 && (
            <div className="ecl-annees" role="group" aria-label={t('driverPay.year')}>
              {annees.map((y) => <button key={y} type="button" className={`ecl-an${y === annee ? ' on' : ''}`} aria-pressed={y === annee} onClick={() => choisirAnnee(y)}>{y}</button>)}
            </div>
          )}
        </div>
        <div className="ecl-gros" aria-label={`${t('driverPay.totalNet')} ${netAffiche || ''}`}>{netAffiche ? <ChiffresRoulants valeur={netAffiche} /> : '…'}</div>
        <p className="ecl-b-sous">{sousBandeau}</p>
        {gains && retenueTotale !== 0 && <p className="ecl-b-sous ecl-b-explique">{t('ecranLivreur.gainsRetenueExplique')}</p>}
        <RouteVelo position={82} />
      </section>

      <div className="ecl-feuille">
        {!gains ? <SkeletonCards count={2} /> : (
          <div className="ecl-site-cols">
            <div className="ecl-site-col">
              {!auMoinsUnGain && courses.length === 0 && <EtatVide icone="euro" titre={t('driverPay.none')} />}
              {auMoinsUnGain && (
                <>
                  <h2 className="ecl-titre-sec">{parSemaine ? t('ecranLivreur.gainsParSemaine') : t('driverPay.byMonth')}</h2>
                  <div className="ecl-barres" style={{ '--n': barres.length }}>
                    {barres.map((b, k) => {
                      const net = Number(b.net || 0);
                      const h = maxBarre > 0 ? (Math.max(0, net) / maxBarre) * 100 : 0;
                      const lib = libelles.get(b.cle);
                      return (
                        <button key={b.cle} type="button" className={`ecl-barre-v${cote(k)}${barreMontree === b.cle ? ' montre' : ''}${net < 0 ? ' negatif' : ''}${net === 0 ? ' vide' : ''}`}
                          style={{ '--h': `${h}%`, '--i': k }} aria-label={bulle(b)} aria-pressed={barreMontree === b.cle}
                          onClick={() => setBarreMontree(barreMontree === b.cle ? null : b.cle)}>
                          <i />
                          {lib && <span className="ecl-bv-lib" aria-hidden="true">{lib}</span>}
                          <span className="ecl-bulle" aria-hidden="true">{bulle(b)}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="ecl-site-col">
              {/* Courses livrées pas encore virées : compte de paiement Stripe pas actif (audit du 19/10/2026, courier-2 ;
                  backend `pending`). Dues quand même, virées dès que le compte l'est : Mon compte › Paiement. */}
              {Number(gains.pending?.amount) > 0 && (
                <ul className="ecl-etapes">
                  <li>
                    <Link to="/account" className="ecl-etape">
                      <span className="ecl-grow"><b>{t('ecranLivreur.gainsEnAttente', { amount: euro(gains.pending.amount) })}</b><small>{t('ecranLivreur.gainsEnAttenteSous')}</small></span>
                      <Icone nom="retour" taille={16} className="bv-chevron" />
                    </Link>
                  </li>
                </ul>
              )}
              {jours.map((j) => (
                <section key={j.cle} className="ecl-jour">
                  <h2 className="ecl-titre-sec">{titreJour(j.quand)}</h2>
                  {j.lignes.map(ligneCourse)}
                </section>
              ))}
              {lignesBas}
            </div>
          </div>
        )}
      </div>

      {fiscalite && (
        <SousEcran titre={t('ecranLivreur.gainsFiscalite')} onFermer={() => setFiscalite(false)}>
          <div className="ecl-fiscalite">
            {aide && <p className="ecl-texte">{aide}</p>}
            <div className="ecl-regles" role="group" aria-label={t('ecranLivreur.ariaRegles')}>
              <span className="ecl-regle"><Icone nom="velo" taille={18} /><b>{t('ecranLivreur.regleGrilleChiffre')}</b>{t('ecranLivreur.regleGrille')}</span>
              <span className="ecl-regle"><Icone nom="cadeau" taille={18} /><b>{t('ecranLivreur.reglePourboiresChiffre')}</b>{t('ecranLivreur.reglePourboires')}</span>
            </div>
            <CopieDac7 chemin={(a) => `/couriers/me/dac7/${a}.pdf`} token={token} annees={annees.slice(0, 2)} />
            <ul className="ecl-etapes">
              <li><Link to="/driver/invoices" className="ecl-etape"><span className="ecl-grow"><b>{t('ecranLivreur.gainsFactures')}</b><small>{t('ecranLivreur.gainsFacturesSous')}</small></span><Icone nom="retour" taille={16} className="bv-chevron" /></Link></li>
              <li><Link to="/driver/onboarding" className="ecl-etape"><span className="ecl-grow"><b>{t('dashDriver.courierFileTitle')}</b><small>{t('dashDriver.courierFileSub')}</small></span><Icone nom="retour" taille={16} className="bv-chevron" /></Link></li>
            </ul>
            <p className="ecl-pied-legal">{t('courierOnboarding.legalFooter', { year: legal.year ?? annee })}</p>
          </div>
        </SousEcran>
      )}
    </div>
  );
}
