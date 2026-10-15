import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import ChoixPastilles from '../../components/ChoixPastilles';
import GraphiqueBarres from '../../components/commerce/GraphiqueBarres';

/* STATISTIQUES DU COMMERCE (comparaison avec Uber Eats Manager, 15 oct. 2026 ; backend analytiqueCommerce.js,
 * GET /restaurants/:id/analytics?days=7|30|90).
 *
 * Le tableau de bord ne montrait que la journée. Ici : chiffre, commandes, panier moyen comparés à la période précédente ;
 * les commandes jour par jour (par semaine sur 90 jours, sinon 90 colonnes de 2 px sur un téléphone), les heures et les
 * jours chargés, et les plats qui marchent. Le choix de période est seul, au-dessus de tout, et vaut pour toute la page.
 * Pendant le rechargement, la page garde l'ancien rendu en transparence plutôt qu'un squelette. */
const PERIODES = ['7', '30', '90'];

function ecart(actuel, avant) {
  if (!avant) return null;
  return Math.round(((actuel - avant) / avant) * 100);
}

function Tuile({ libelle, valeur, delta, t }) {
  return (
    <div className="card" style={{ margin: 0, padding: '12px 14px' }}>
      <div className="small" style={{ color: 'var(--ink-soft)' }}>{libelle}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{valeur}</div>
      {delta !== undefined && (
        <div className="small" style={{ color: 'var(--ink-soft)', marginTop: 2 }}>
          {delta === null ? t('statsResto.noPrevious') : `${delta > 0 ? '↑ +' : delta < 0 ? '↓ ' : ''}${delta} % ${t('statsResto.vsPrevious')}`}
        </div>
      )}
    </div>
  );
}

export default function StatsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const { restoId } = useOutletContext() || {};
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
        return { cle: bloc[0].jour, libelle: t('statsResto.weekOf', { date: jourCourt(bloc[0].jour) }), court: jourCourt(bloc[0].jour), valeur: bloc.reduce((a, d) => a + d.commandes, 0), detail: euros(bloc.reduce((a, d) => a + d.chiffre, 0)) };
      })
    : donnees.parJour.map((d) => ({ cle: d.jour, libelle: jourCourt(d.jour), valeur: d.commandes, detail: euros(d.chiffre) }));
  const nomsJours = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 12 + i).toLocaleDateString(locale, { weekday: 'short' })); // 12/10/2026 = lundi

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('statsResto.title')}</h2>
      <div style={{ marginBottom: 12 }}>
        <ChoixPastilles libelle={t('statsResto.period')} valeur={jours} onChange={setJours}
          options={PERIODES.map((p) => ({ value: p, label: t(`statsResto.days${p}`) }))} />
      </div>
      {erreur && !donnees && <p className="small" role="alert">{erreur}</p>}
      {!donnees && !erreur && <p className="small">…</p>}
      {donnees && (
        <div style={{ opacity: charge ? 0.5 : 1, transition: 'opacity .15s' }}>
          {donnees.commandes === 0 && <p className="small" style={{ margin: '0 0 12px' }}>{t('statsResto.empty')}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            <Tuile t={t} libelle={t('statsResto.revenue')} valeur={euros(donnees.chiffreAffaires)} delta={ecart(donnees.chiffreAffaires, donnees.precedent.chiffreAffaires)} />
            <Tuile t={t} libelle={t('statsResto.orders')} valeur={nombre(donnees.commandes)} delta={ecart(donnees.commandes, donnees.precedent.commandes)} />
            <Tuile t={t} libelle={t('statsResto.basket')} valeur={euros(donnees.panierMoyen)} delta={ecart(donnees.panierMoyen, donnees.precedent.panierMoyen)} />
            <Tuile t={t} libelle={t('statsResto.acceptance')} valeur={donnees.tauxAcceptation === null ? '–' : `${Math.round(donnees.tauxAcceptation * 100)} %`} />
            <Tuile t={t} libelle={t('statsResto.prep')} valeur={donnees.preparationMedianeMin === null ? '–' : t('statsResto.minutes', { n: donnees.preparationMedianeMin })} />
            <Tuile t={t} libelle={t('statsResto.returning')} valeur={t('statsResto.returningValue', { n: donnees.clientsRevenus, total: donnees.clients })} />
          </div>
          <p className="small" style={{ margin: '0 0 16px', color: 'var(--ink-soft)' }}>
            {t('statsResto.split', { delivery: donnees.livraison, pickup: donnees.emporter, refused: donnees.refusees, expired: donnees.expirees })}
            {donnees.avis.nombre > 0 && ` ${t('statsResto.reviews', { n: donnees.avis.nombre, rating: donnees.avis.moyenne.toLocaleString(locale) })}`}
          </p>

          <div className="card">
            <GraphiqueBarres titre={t(donnees.jours === 90 ? 'statsResto.chartWeeks' : 'statsResto.chartDays')} donnees={serie}
              formatValeur={nombre} libelleTableau={t('statsResto.asTable')} />
          </div>
          <div className="card">
            <GraphiqueBarres titre={t('statsResto.chartHours')} hauteur={150}
              donnees={donnees.parHeure.map((n, h) => ({ cle: String(h), libelle: t('statsResto.hourRange', { h, h2: (h + 1) % 24 }), court: `${h}h`, valeur: n }))}
              formatValeur={nombre} libelleTableau={t('statsResto.asTable')} />
          </div>
          <div className="card">
            <GraphiqueBarres titre={t('statsResto.chartWeekdays')} hauteur={150}
              donnees={donnees.parJourSemaine.map((n, d) => ({ cle: String(d), libelle: nomsJours[d], valeur: n }))}
              formatValeur={nombre} libelleTableau={t('statsResto.asTable')} />
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('statsResto.topDishes')}</h3>
            {donnees.topPlats.length === 0 ? <p className="small" style={{ margin: 0 }}>{t('statsResto.noDishes')}</p> : (
              <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: 'left', padding: '4px 0' }}>{t('statsResto.dish')}</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '4px 0' }}>{t('statsResto.sold')}</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '4px 0' }}>{t('statsResto.revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees.topPlats.map((p) => (
                    <tr key={p.nom} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '4px 8px 4px 0' }}>{p.nom}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{nombre(p.quantite)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{euros(p.chiffre)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="small" style={{ color: 'var(--ink-soft)' }}>{t('statsResto.footnote')}</p>
        </div>
      )}
    </div>
  );
}
