import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { DAY_KEYS } from '../../openingHours';
import { euros } from '../../prixPlat';
import Icone from '../Icone';
import { VeloMarque } from './BandeauCommerce';
import { communeClient, partCommerce } from './clientCommande';
import { useVirements } from './VirementsCommerce';

/* L'ACCUEIL DU COMMERCE : SA SOIRÉE D'ABORD, LES RÉGLAGES APRÈS (audit design 2, section 3, fondateur 2026-10-19).
 *
 * Le bandeau parle de la soirée du commerce : « Ce soir chez Maestro pizza », ouvert ou non, « 5 commandes, 112,40 € pour
 * toi », les communes où sont parties ses commandes, et le vélo de la marque sur la route de son service, de l'ouverture à
 * la fermeture, à l'heure qu'il est. Avant la première commande : « Pas encore de commande ce soir ».
 *
 * « Pour toi » = ce que le commerce garde (partCommerce, la formule du virement côté serveur), calculé des commandes déjà
 * chargées par le tableau de bord — aucune route en plus. Commandes du jour (« ce soir » à partir de 16 h, « aujourd'hui »
 * avant), ni refusées, ni annulées, ni d'essai. C'est l'écran du commerce : y montrer ce qu'il garde est permis ; la
 * commission elle-même n'est pas affichée. Ne s'affiche que quand la mise en ligne est finie (EditPage garde sinon la route
 * des étapes). */
const minutes = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const finie = (o) => o.status === 'refuse' || o.status === 'annule';
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Le service du jour : première ouverture, dernière fermeture (une fermeture à 00:00 ou avant l'ouverture passe minuit).
function serviceDuJour(hours, maintenant) {
  const creneaux = (hours?.[DAY_KEYS[maintenant.getDay()]] || []).filter((c) => c?.open && c?.close);
  if (!creneaux.length) return null;
  const debut = Math.min(...creneaux.map((c) => minutes(c.open)));
  const fin = Math.max(...creneaux.map((c) => { const o = minutes(c.open); const f = minutes(c.close); return f <= o ? f + 1440 : f; }));
  if (debut === null || !(fin > debut)) return null;
  return { debut, fin };
}

function useSoiree(restaurant, orders) {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setMaintenant(new Date()), 60000); return () => clearInterval(id); }, []);
  const jour = maintenant.toDateString();
  const duJour = (orders || []).filter((o) => !finie(o) && !o.isTraining && new Date(o.createdAt).toDateString() === jour);
  const montant = duJour.reduce((s, o) => s + partCommerce(o), 0);
  const communes = [...new Set(duJour.map(communeClient).filter(Boolean))];
  return { maintenant, n: duJour.length, montant, communes, service: serviceDuJour(restaurant?.hours, maintenant), soir: maintenant.getHours() >= 16 };
}

export function BandeauSoir({ restaurant: r, orders }) {
  const { t } = useLanguage();
  const s = useSoiree(r, orders);
  const enPause = r.pausedUntil && r.pausedUntil > s.maintenant.getTime();
  const ouvert = r.open && !enPause && r.openStatus?.isOpen !== false;
  const titre = s.n === 0
    ? t(s.soir ? 'serviceCommerce.aucuneCeSoir' : 'serviceCommerce.aucuneAujourdhui')
    : t(s.n === 1 ? 'serviceCommerce.soirUne' : 'serviceCommerce.soirN', { n: s.n, amount: euros(s.montant) });
  // Position du vélo sur la route du service (0 à l'ouverture, 1 à la fermeture).
  const minNow = s.maintenant.getHours() * 60 + s.maintenant.getMinutes();
  const p = s.service ? Math.min(1, Math.max(0, ((minNow < s.service.debut - 360 ? minNow + 1440 : minNow) - s.service.debut) / (s.service.fin - s.service.debut))) : 0;
  const heure = s.maintenant.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <div className="ec-b-haut">
        <span>{t(s.soir ? 'serviceCommerce.ceSoirChez' : 'serviceCommerce.aujourdhuiChez')} <b>{r.name}</b></span>
        <span className="ec-chip">{enPause ? t('serviceCommerce.enPause') : ouvert ? t('serviceCommerce.ouvert') : t('serviceCommerce.ferme')}</span>
      </div>
      <h1 className="ec-b-titre">{titre}</h1>
      {s.communes.length > 0 && <p className="ec-b-sous">{s.communes.slice(0, 5).join(' · ')}</p>}
      {s.service && (
        <div className="ec-soir" aria-label={t('serviceCommerce.routeService', { debut: hhmm(s.service.debut), fin: hhmm(s.service.fin) })} role="img">
          <div className="ec-soir-route">
            <span className="ec-soir-fait" style={{ width: `${p * 100}%` }} />
            <span className="ec-soir-velo" style={{ left: `${p * 100}%` }}><VeloMarque largeur={34} /></span>
          </div>
          <div className="ec-soir-heures" aria-hidden="true">
            <span>{hhmm(s.service.debut)}</span>
            {p > 0.14 && p < 0.86 && <span className="ec-soir-maintenant" style={{ left: `${p * 100}%` }}>{heure}</span>}
            <span>{hhmm(s.service.fin)}</span>
          </div>
        </div>
      )}
    </>
  );
}

/* LES OUTILS DU QUOTIDIEN EN TUILES (même audit) : Statistiques, Promotions, Factures — chacune ouvre la page
 * qui existe déjà (elles gardent leur « ← Mon compte »), avec une ligne qui dit où on en est. Les promotions et la dernière
 * facture sont lues une fois à l'ouverture de l'accueil (deux petites lectures) ; le reste vient du tableau de bord.
 * La tuile Avis est partie le 22/10/2026 avec les avis clients (fondateur : pas assez d'utilisateurs, des commerces avec peu
 * d'étoiles feraient mauvaise impression ; on les refera peut-être plus tard). Trois tuiles : ecran-commerce.css étale la
 * dernière sur la largeur au téléphone. */
export function TuilesCommerce({ restaurant: r, orders, restoId, token }) {
  const { t } = useLanguage();
  const statsService = useOutletContext()?.statsService;
  const [promos, setPromos] = useState(null);
  const [facture, setFacture] = useState(undefined);
  useEffect(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}/promotions/mine`, { token }).then((l) => setPromos(Array.isArray(l) ? l : [])).catch(() => setPromos(null));
    api('/invoices/restaurant', { token }).then((d) => {
      const l = (d?.invoices || []).filter((i) => i.status !== 'annulee');
      setFacture(l.sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart))[0] || null);
    }).catch(() => setFacture(undefined));
  }, [restoId, token]);

  const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
  // Compté par le serveur quand le tableau ne reçoit que les commandes en cours et des dernières 24 h (vue « service »,
  // audit du 19/10, shop-213) ; la liste complète reste le repli.
  const ceMois = statsService?.monthCount ?? (orders || []).filter((o) => !finie(o) && !o.isTraining && Number(o.createdAt) >= debutMois.getTime()).length;
  const actives = promos === null ? null : promos.filter((x) => x.active).length + (r.fairideAdvantage ? 1 : 0);
  const statutFacture = { emise: 'invoiceArchive.statusIssued', envoyee: 'invoiceArchive.statusSent', payee: 'invoiceArchive.statusPaid' };
  const mois = facture ? new Date(facture.periodStart).toLocaleDateString(getLocale(), { month: 'long', timeZone: 'Europe/Brussels' }) : '';

  const virements = useVirements(restoId, token);
  /* Le prochain virement (fondateur, 2026-10-31, maquettes/revue-parcours, question 2 B) : en tête, sur toute la largeur,
     dès qu'un euro payé en ligne est passé par son compte ; il ouvre l'onglet « Virements » de Factures. */
  const vedette = virements?.enCours && (virements.enCours.montant > 0 || virements.versements?.length > 0)
    ? { to: '/dashboard/invoices', icone: 'banque', vedette: true, onglet: 'virements',
      titre: t('virements.prochainTuile', { jour: new Date(`${virements.enCours.date}T12:00:00Z`).toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' }) }),
      montant: euros(virements.enCours.montant), sous: t('virements.prochainTuileSous') }
    : null;
  const tuiles = [
    ...(vedette ? [vedette] : []),
    { to: '/dashboard/stats', icone: 'stats', titre: t('serviceCommerce.tuileStats'),
      sous: ceMois ? t(ceMois === 1 ? 'serviceCommerce.ceMoisUne' : 'serviceCommerce.ceMoisN', { n: ceMois }) : t('serviceCommerce.ceMoisAucune') },
    { to: '/dashboard/promotions', icone: 'etiquette', titre: t('serviceCommerce.tuilePromos'),
      sous: actives === null ? '' : actives ? t(actives === 1 ? 'serviceCommerce.promosUne' : 'serviceCommerce.promosN', { n: actives }) : t('serviceCommerce.promosAucune') },
    { to: '/dashboard/invoices', icone: 'document', titre: t('serviceCommerce.tuileFactures'),
      sous: facture === undefined ? '' : facture ? `${mois.charAt(0).toUpperCase()}${mois.slice(1)} · ${t(statutFacture[facture.status] || 'invoiceArchive.statusIssued').toLowerCase()}` : t('serviceCommerce.facturesAucune') }
  ];
  return (
    <nav className="ec-outils" aria-label={t('serviceCommerce.outils')}>
      {tuiles.map((x) => (
        <Link key={x.vedette ? 'virements' : x.to} to={x.to} className={`ec-outil${x.vedette ? ' ec-outil--vedette' : ''}`}
          onClick={x.onglet ? () => { try { sessionStorage.setItem('fairide_factures_onglet', x.onglet); } catch { /* sans stockage */ } } : undefined}>
          <span className="ec-ligne-tuile" aria-hidden="true"><Icone nom={x.icone} taille={20} /></span>
          {x.vedette ? <><small>{x.titre}</small><b className="ec-outil-montant">{x.montant}</b></> : <b>{x.titre}</b>}
          <small>{x.sous || ' '}</small>
        </Link>
      ))}
    </nav>
  );
}
