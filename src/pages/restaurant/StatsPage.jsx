import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import GraphiqueBarres from '../../components/commerce/GraphiqueBarres';
import ChiffresRoulants from '../../components/ChiffresRoulants';
import { BandeauCommerce, FeuilleCommerce, SegmentGlisse } from '../../components/commerce/BandeauCommerce';
import { vibrer } from '../../gestes';

/* STATISTIQUES DU COMMERCE (comparaison avec Uber Eats Manager, 15 oct. 2026 ; backend analytiqueCommerce.js,
 * GET /restaurants/:id/analytics?days=7|30|90).
 *
 * Le tableau de bord ne montrait que la journée. Ici : chiffre, commandes, panier moyen comparés à la période précédente ;
 * les commandes jour par jour (par semaine sur 90 jours, sinon 90 colonnes de 2 px sur un téléphone), les heures et les
 * jours chargés, et les plats qui marchent. Le choix de période est seul, au-dessus de tout, et vaut pour toute la page.
 * Pendant le rechargement, la page garde l'ancien rendu en transparence plutôt qu'un squelette.
 *
 * NOUVEAU STYLE (fondateur, 2026-10-16, mockups/tous-les-ecrans.html › Statistiques, « Le chiffre en grand ») : sur le
 * bandeau iris, « ← Mon compte », la période au pouce lime qui glisse et le chiffre en grand dont les chiffres roulent
 * (ChiffresRoulants) ; dans la feuille, les tuiles, les barres qui poussent (toucher une barre montre son nombre,
 * GraphiqueBarres) et les plats avec leur barre. Les notes n'apparaissent que s'il y a des avis. */
const PERIODES = ['7', '30', '90'];

function ecart(actuel, avant) {
  if (!avant) return null;
  return Math.round(((actuel - avant) / avant) * 100);
}

// `delta` : « ↑ +12 % », null sans période précédente, undefined pour une tuile sans comparaison.
function Tuile({ libelle, valeur, delta, t }) {
  return (
    <div className="ec-tuile-stat">
      <small>{libelle}</small>
      <b>{valeur}</b>
      {delta !== undefined && <span className={`ec-hausse${delta === null ? ' ec-hausse--neutre' : ''}`}>{delta ?? t('statsResto.noPrevious')}</span>}
    </div>
  );
}

export default function StatsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const { restoId, restaurant, communs } = useOutletContext() || {};
  const [jours, setJours] = useState('30');
  const [donnees, setDonnees] = useState(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!restoId) return undefined;
    let actif = true;
    setCharge(true);
    api(`/restaurants/${restoId}/analytics?days=${jours}`, { token })
      // Serveur d'avant cette route, ou réponse inattendue : un message, pas une page plantée.
      .then((d) => { if (!actif) return; if (d && Array.isArray(d.parJour)) { setDonnees(d); setErreur(null); } else setErreur(t('statsResto.loadFailed')); })
      .catch((e) => { if (actif) setErreur(e.message); })
      .finally(() => { if (actif) setCharge(false); });
    return () => { actif = false; };
    // `t` sert seulement au message d'erreur : le changer ne doit pas recharger les chiffres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId, token, jours]);

  const locale = getLocale();
  const jourCourt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const nombre = (n) => Number(n || 0).toLocaleString(locale);

  // 90 jours : regroupés par semaine de 7 jours, en partant du plus ancien.
  const serie = !donnees ? [] : donnees.jours === 90
    ? Array.from({ length: Math.ceil(donnees.parJour.length / 7) }, (_, s) => {
        const bloc = donnees.parJour.slice(s * 7, s * 7 + 7);
        return { cle: `90-${bloc[0].jour}`, libelle: t('statsResto.weekOf', { date: jourCourt(bloc[0].jour) }), court: jourCourt(bloc[0].jour), valeur: bloc.reduce((a, d) => a + d.commandes, 0), detail: euros(bloc.reduce((a, d) => a + d.chiffre, 0)) };
      })
    : donnees.parJour.map((d) => ({ cle: `${donnees.jours}-${d.jour}`, libelle: jourCourt(d.jour), valeur: d.commandes, detail: euros(d.chiffre) }));
  const nomsJours = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 12 + i).toLocaleDateString(locale, { weekday: 'short' })); // 12/10/2026 = lundi

  const delta = (actuel, avant) => {
    const e = ecart(actuel, avant);
    return e === null ? null : `${e > 0 ? '↑ +' : e < 0 ? '↓ ' : ''}${e} %`;
  };
  const d = donnees;
  const deltaChiffre = d ? delta(d.chiffreAffaires, d.precedent.chiffreAffaires) : null;
  const maxTop = d ? Math.max(1, ...d.topPlats.map((p) => p.quantite)) : 1;

  return (
    <div>
      {/* LE BANDEAU (2026-10-16, « Le chiffre en grand ») : la période se choisit au pouce lime, le chiffre roule. */}
      <BandeauCommerce retour>
        <div className="ec-b-haut">
          <Link to="/account" state={{ restaurerDefilement: true }} className="ec-b-retour">{t('nav.backToAccount')}</Link>
          {restaurant?.name && <span><b>{restaurant.name}</b></span>}
        </div>
        <h1 className="ec-b-titre" style={{ fontSize: 26 }}>{t('statsResto.title')}</h1>
        <SegmentGlisse lime libelle={t('statsResto.period')} valeur={jours} onChange={(v) => { vibrer(8); setJours(v); }}
          options={PERIODES.map((p) => ({ value: p, label: t(`statsResto.days${p}`) }))} />
        <p className="ec-b-sous" style={{ marginTop: 16 }}>{t('statsResto.revenue')}</p>
        <div className="ec-gros-chiffre" aria-live="polite">{d ? <ChiffresRoulants valeur={euros(d.chiffreAffaires)} /> : '…'}</div>
        {d && <p className="ec-b-sous">{deltaChiffre ? `${deltaChiffre} ${t('statsResto.vsPrevious')}` : t('statsResto.noPrevious')}</p>}
      </BandeauCommerce>
      <FeuilleCommerce>
        {communs}
        {erreur && !d && <p className="small" role="alert">{erreur}</p>}
        {!d && !erreur && <p className="small">…</p>}
        {d && (
          <div style={{ opacity: charge ? 0.5 : 1, transition: 'opacity .15s' }}>
            {d.commandes === 0 && <p className="small" style={{ margin: '0 0 12px' }}>{t('statsResto.empty')}</p>}
            {/* La clé change avec la période : les tuiles remontent, comme les barres poussent. */}
            <div className="ec-tuiles" key={`tuiles-${d.jours}`}>
              <Tuile libelle={t('statsResto.orders')} valeur={nombre(d.commandes)} delta={delta(d.commandes, d.precedent.commandes)} t={t} />
              <Tuile libelle={t('statsResto.basket')} valeur={euros(d.panierMoyen)} delta={delta(d.panierMoyen, d.precedent.panierMoyen)} t={t} />
              <Tuile libelle={t('statsResto.acceptance')} valeur={d.tauxAcceptation === null ? '–' : `${Math.round(d.tauxAcceptation * 100)} %`} />
              <Tuile libelle={t('statsResto.prep')} valeur={d.preparationMedianeMin === null ? '–' : t('statsResto.minutes', { n: d.preparationMedianeMin })} />
              <Tuile libelle={t('statsResto.returning')} valeur={t('statsResto.returningValue', { n: d.clientsRevenus, total: d.clients })} />
            </div>
            <p className="small" style={{ margin: '12px 0 0', color: 'var(--ink-soft)' }}>
              {t('statsResto.split', { delivery: d.livraison, pickup: d.emporter, refused: d.refusees, expired: d.expirees })}
              {/* Les notes seulement s'il y a des avis (fondateur : jamais d'étoiles sans avis). */}
              {d.avis?.nombre > 0 && ` ${t('statsResto.reviews', { n: d.avis.nombre, rating: d.avis.moyenne.toLocaleString(locale) })}`}
            </p>

            <div className="ec-graphique">
              <GraphiqueBarres titre={t(d.jours === 90 ? 'statsResto.chartWeeks' : 'statsResto.chartDays')} donnees={serie}
                formatValeur={nombre} libelleTableau={t('statsResto.asTable')} />
            </div>
            <div className="ec-graphique">
              <GraphiqueBarres titre={t('statsResto.chartHours')} hauteur={150}
                donnees={d.parHeure.map((n, h) => ({ cle: `${d.jours}-${h}`, libelle: t('statsResto.hourRange', { h, h2: (h + 1) % 24 }), court: `${h}h`, valeur: n }))}
                formatValeur={nombre} libelleTableau={t('statsResto.asTable')} />
            </div>
            <div className="ec-graphique">
              <GraphiqueBarres titre={t('statsResto.chartWeekdays')} hauteur={150}
                donnees={d.parJourSemaine.map((n, j) => ({ cle: `${d.jours}-${j}`, libelle: nomsJours[j], valeur: n }))}
                formatValeur={nombre} libelleTableau={t('statsResto.asTable')} />
            </div>

            <p className="ec-feuille-titre">{t('statsResto.topDishes')}</p>
            {d.topPlats.length === 0 ? <p className="small" style={{ margin: 0 }}>{t('statsResto.noDishes')}</p> : (
              <div role="table" aria-label={t('statsResto.topDishes')} key={`top-${d.jours}`}>
                <div role="row" className="sr-only">
                  <span role="columnheader">{t('statsResto.dish')}</span><span role="columnheader">{t('statsResto.sold')}</span><span role="columnheader">{t('statsResto.revenue')}</span>
                </div>
                {d.topPlats.map((p) => (
                  <div role="row" className="ec-top-plat" key={p.nom}>
                    <span role="cell" className="ec-top-plat-nom"><b>{p.nom}</b><span className="ec-top-plat-barre" aria-hidden="true"><i style={{ width: `${(p.quantite / maxTop) * 100}%` }} /></span></span>
                    <span className="ec-top-plat-chiffres"><b role="cell">{nombre(p.quantite)}</b><small role="cell">{euros(p.chiffre)}</small></span>
                  </div>
                ))}
              </div>
            )}
            <p className="small" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>{t('statsResto.footnote')}</p>
          </div>
        )}
      </FeuilleCommerce>
    </div>
  );
}
