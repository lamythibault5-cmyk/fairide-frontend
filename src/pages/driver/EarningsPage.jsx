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
import { experienceApp } from '../../natif';
import { vibrer } from '../../gestes';
import '../../ecran-livreur.css';
import '../../site-livreur.css';

// « Mes gains » (livreur) : ce que Fairide a versé sur l'année, brut / précompte / net, par mois et par
// course (/couriers/me/earnings), avec la jauge du plafond pour l'économie collaborative et un rappel
// des règles du statut. Aucun chiffre légal n'est écrit ici : tout vient de `legal` (/couriers/me).
// Cette page n'affiche ni classement, ni objectif, ni cadence : elle rend compte, elle n'impose rien.
//
// LE NET EN GRAND (fondateur, 2026-10-16, mockups/tous-les-ecrans.html, partie Livreur, « Gains ») : l'année se choisit
// sur le bandeau iris, le net versé y roule (ChiffresRoulants), les mois sont des barres iris (toucher une barre montre son
// net et ses courses), et deux tuiles disent les deux règles du livreur, déjà écrites partout ailleurs : 90 % de sa
// grille, 100 % des pourboires. Le détail sépare d'un coup d'œil courses et pourboires. Mêmes données qu'avant.
//
// SUR LE SITE, SUR UN ORDINATEUR (mockups/site-ordinateur.html, 2026-10-16) : les règles et les mois à gauche, le détail à
// droite (site-livreur.css). Les deux enveloppes .ecl-site-col n'ont pas de boîte ailleurs : l'app et le téléphone gardent
// leur colonne unique.
const PREMIERE_ANNEE = 2026;
const euro = (n) => `${Number(n || 0).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pctTexte = (x) => (x == null || x === '' ? '—' : `${(Number(x) * 100).toLocaleString(getLocale(), { maximumFractionDigits: 2 })} %`);
// Montant signé : une contre-écriture ou une correction négative se lit en rouge, sans ambiguïté.
function Montant({ v, strong }) {
  const n = Number(v || 0);
  const style = n < 0 ? { color: 'var(--red)' } : undefined;
  return strong ? <b style={style}>{euro(n)}</b> : <span style={style}>{euro(n)}</span>;
}
// Couleur de l'étiquette d'une ligne du détail : course en iris pâle, pourboire en lime, le reste en gris.
const BADGES = { delivery: 'doux', tip: 'lime' };

export default function EarningsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [gains, setGains] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [moisMontre, setMoisMontre] = useState(null);
  // Le dernier net affiché : pendant le chargement d'une autre année, il reste en place, puis seuls les chiffres qui
  // changent roulent.
  const [netAffiche, setNetAffiche] = useState(null);
  const annees = useMemo(() => { const a = new Date().getFullYear(); const l = []; for (let y = a; y >= Math.min(a, PREMIERE_ANNEE); y--) l.push(y); return l; }, []);

  useEffect(() => { api('/couriers/me', { token }).then(setDossier).catch(() => setDossier({})); }, [token]);
  useEffect(() => {
    setGains(null);
    setMoisMontre(null);
    api(`/couriers/me/earnings?year=${annee}`, { token }).then(setGains).catch((e) => { toast(e.message, 'erreur'); setGains({ year: annee, totals: {}, byMonth: [], lines: [], ceiling: null }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, annee]);
  useEffect(() => { if (gains) setNetAffiche(euro(gains.totals?.net)); }, [gains]);

  const legal = dossier?.legal ?? {};
  const statut = dossier?.courier?.statusType;
  const totaux = gains?.totals ?? {};
  const mois = gains?.byMonth ?? [];
  const lignes = gains?.lines ?? [];
  const locale = getLocale();
  const nomMois = (m, format = 'long') => new Date(annee, Number(m) - 1, 1).toLocaleDateString(locale, { month: format });
  // CODE-12 : plus de plafond ni de précompte (économie collaborative retirée) — un rappel par statut d'indépendant.
  const aide = statut === 'student_independent' ? t('driverPay.help_student_independent')
    : statut === 'independent' ? t('driverPay.help_independent', { rate: pctTexte(legal.independentSocialRate) }) : null;
  const nbCourses = totaux.deliveries ?? 0;
  const retenueTotale = Number(totaux.withholding || 0);
  const maxMois = Math.max(0, ...mois.map((m) => Number(m.net || 0)));
  // Ce que dit une barre touchée : le net et le nombre de courses ; le brut et la retenue quand il y en a une.
  const bulle = (m) => {
    const n = m.deliveries ?? 0;
    const base = n === 1 ? t('ecranLivreur.bulleUne', { net: euro(m.net) }) : t('ecranLivreur.bulle', { net: euro(m.net), n });
    return Number(m.withholding || 0) !== 0 ? `${base} · ${t('driverPay.gross')} ${euro(m.gross)} · ${t('driverPay.withholding')} ${euro(m.withholding)}` : base;
  };

  function choisirAnnee(y) {
    if (y === annee) return;
    if (experienceApp()) vibrer(8);
    setAnnee(y);
  }

  return (
    <div className="ecl ecl-gains">
      <section className="ecl-bandeau">
        <div className="ecl-b-haut">
          <h1 style={{ margin: 0, font: 'inherit', color: '#fff', fontWeight: 600 }}>{t('driverPay.title')}</h1>
          <div className="ecl-annees" role="group" aria-label={t('driverPay.year')}>
            {annees.map((y) => <button key={y} type="button" className={`ecl-an${y === annee ? ' on' : ''}`} aria-pressed={y === annee} onClick={() => choisirAnnee(y)}>{y}</button>)}
          </div>
        </div>
        <p className="ecl-b-sous ecl-net-lib">{t('driverPay.totalNet')}</p>
        <div className="ecl-gros">{netAffiche ? <ChiffresRoulants valeur={netAffiche} /> : '…'}</div>
        <p className="ecl-b-sous">
          {gains ? (nbCourses === 1 ? t('ecranLivreur.brutUneCourse', { gross: euro(totaux.gross) }) : t('ecranLivreur.brutCourses', { gross: euro(totaux.gross), n: nbCourses })) : t('driverPay.intro')}
          {gains && retenueTotale !== 0 && ` · ${t('driverPay.totalWithholding')} ${euro(retenueTotale)}`}
        </p>
        <RouteVelo position={82} />
      </section>

      <div className="ecl-feuille">
        <div className="ecl-site-cols">
          <div className="ecl-site-col">
            <div className="ecl-regles" role="group" aria-label={t('ecranLivreur.ariaRegles')}>
              <span className="ecl-regle"><Icone nom="scooter" taille={18} /><b>{t('ecranLivreur.regleGrilleChiffre')}</b>{t('ecranLivreur.regleGrille')}</span>
              <span className="ecl-regle"><Icone nom="cadeau" taille={18} /><b>{t('ecranLivreur.reglePourboiresChiffre')}</b>{t('ecranLivreur.reglePourboires')}</span>
            </div>
            {aide && <p className="small ecl-aide">{aide}</p>}

            {!gains ? <div style={{ marginTop: 16 }}><SkeletonCards count={2} /></div> : (
              <>
                {mois.length === 0 && lignes.length === 0 && <EtatVide icone="euro" titre={t('driverPay.none')} />}

                {mois.length > 0 && (
                  <>
                    <h2 className="ecl-titre-sec">{t('driverPay.byMonth')}</h2>
                    <div className="ecl-barres" style={{ '--n': mois.length }}>
                      {mois.map((m, k) => {
                        const net = Number(m.net || 0);
                        const h = maxMois > 0 ? (Math.max(0, net) / maxMois) * 100 : 0;
                        return (
                          <button key={m.month} type="button" className={`ecl-barre-v${moisMontre === m.month ? ' montre' : ''}${net < 0 ? ' negatif' : ''}`}
                            style={{ '--h': `${h}%`, '--i': k }} aria-label={`${nomMois(m.month)} : ${bulle(m)}`} aria-pressed={moisMontre === m.month}
                            onClick={() => setMoisMontre(moisMontre === m.month ? null : m.month)}>
                            <i />
                            <span className="ecl-bv-lib" aria-hidden="true">{nomMois(m.month, 'short')}</span>
                            <span className="ecl-bulle" aria-hidden="true">{bulle(m)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {gains && lignes.length > 0 && (
            <div className="ecl-site-col">
              <h2 className="ecl-titre-sec" style={{ marginTop: 30 }}>{t('driverPay.lines')}</h2>
              {lignes.map((l) => {
                const quand = l.earnedAt ? new Date(l.earnedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '-';
                const retenue = Number(l.withholding || 0) !== 0 ? `${t('driverPay.gross')} ${euro(l.gross)} · ${t('driverPay.withholding')} ${euro(l.withholding)}${l.withholdingRate != null ? ` (${pctTexte(l.withholdingRate)})` : ''}` : null;
                const sous = [quand, retenue, l.statusAtTime ? t(`courierOnboarding.status_${l.statusAtTime}`) : null].filter(Boolean).join(' · ');
                return (
                  <div className="ecl-detail" key={l.id}>
                    <span className={`ecl-badge ${BADGES[l.kind] || 'neutre'}`}>{['delivery', 'tip', 'reversal', 'correction'].includes(l.kind) ? t(`driverPay.kind_${l.kind}`) : l.kind}{l.reversesId ? ' ↩︎' : ''}</span>
                    <span className="ecl-grow">{l.orderId ? `#${String(l.orderId).slice(0, 8)}` : '-'}<small>{sous}</small></span>
                    <Montant v={l.net} strong />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <p className="small ecl-liens"><Link to="/driver/invoices">{t('driverPay.invoicesLink')}</Link> · <Link to="/driver/onboarding">{t('driverPay.fileLink')}</Link></p>
      </div>
    </div>
  );
}
