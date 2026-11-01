import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import { vibrer } from '../../gestes';

/* LES VIREMENTS DU COMMERCE (fondateur, 2026-10-31, maquettes/revue-parcours, question 2 B ; GET /restaurants/:id/payouts,
   virementsCommerce.js côté serveur). En haut, le prochain virement (ce que Stripe tient pour lui, parti le lundi) ; dessous,
   un lundi par ligne : touche-la, chaque commande (prix − 10 % = sa part), chaque retenue, le total. Les commandes payées au
   comptoir sont dites à part : déjà dans sa caisse, pas dans le virement. Onglet « Virements » de Factures. */
const eur = (n) => euros(n);
const jourLong = (ms) => new Date(ms).toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' });
const dateCourte = (ms) => new Date(ms).toLocaleDateString(getLocale(), { day: 'numeric', month: 'numeric', timeZone: 'Europe/Brussels' });
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Le prochain virement, partagé avec la tuile de l'accueil (CeSoir) : une seule lecture.
export function useVirements(restoId, token) {
  const [d, setD] = useState(null);
  useEffect(() => {
    if (!restoId || !token) return undefined;
    let actif = true;
    api(`/restaurants/${restoId}/payouts`, { token }).then((r) => { if (actif) setD(r?.enCours ? { versements: [], ...r } : false); }).catch(() => { if (actif) setD(false); });
    return () => { actif = false; };
  }, [restoId, token]);
  return d;
}

function Ligne({ l, t }) {
  if (l.nature === 'commande') {
    return (
      <div className="ec-vir-ligne">
        <span>{t('virements.commande', { n: l.numero, type: t(l.type === 'delivery' ? 'virements.livraison' : 'virements.emporter'), date: dateCourte(l.date) })}
          <small>{t('virements.moinsDix', { prix: eur(l.prix) })}</small></span>
        <b>{eur(l.montant)}</b>
      </div>
    );
  }
  if (l.nature === 'retenue') {
    return <div className="ec-vir-ligne moins"><span>{l.numero ? t('virements.retenueCommande', { n: l.numero }) : t('virements.retenue')}</span><b>{eur(l.montant)}</b></div>;
  }
  return <div className="ec-vir-ligne"><span>{t('virements.autre')}</span><b>{eur(l.montant)}</b></div>;
}

function Semaine({ titre, sous, montant, etat, lignes, comptoir, ouvertDepart, t }) {
  const [ouvert, setOuvert] = useState(ouvertDepart);
  return (
    <div className={`ec-vir-semaine${ouvert ? ' ouvert' : ''}`}>
      <button type="button" className="ec-vir-tete" aria-expanded={ouvert} onClick={() => { vibrer(); setOuvert(!ouvert); }}>
        <span><b>{titre}</b><small>{sous}</small></span>
        <span className="ec-vir-montant"><b>{eur(montant)}</b><em className={etat.classe}>{etat.texte}</em></span>
        <span className="ec-vir-chev" aria-hidden="true">›</span>
      </button>
      {ouvert && (
        <div className="ec-vir-detail">
          {lignes.length ? lignes.map((l, k) => <Ligne key={`${l.orderId || 'x'}-${k}`} l={l} t={t} />) : <p className="ec-aide">{t('virements.rien')}</p>}
          <div className="ec-vir-ligne total"><span>{t('virements.surTonCompte')}</span><b>{eur(montant)}</b></div>
          {comptoir?.nombre > 0 && <p className="ec-aide">{t(comptoir.nombre === 1 ? 'virements.comptoirUne' : 'virements.comptoirN', { n: comptoir.nombre, montant: eur(comptoir.montant) })}</p>}
        </div>
      )}
    </div>
  );
}

export default function VirementsCommerce({ restoId, token }) {
  const { t } = useLanguage();
  const d = useVirements(restoId, token);
  if (d === null) return <p className="ec-aide">{t('virements.chargement')}</p>;
  if (d === false) return <p className="ec-aide">{t('virements.erreur')}</p>;
  const prochain = d.enCours;
  const lundi = new Date(`${prochain.date}T12:00:00Z`).getTime();
  const STATUT = { paid: ['virements.verse', 'vert'], in_transit: ['virements.enRoute', ''], pending: ['virements.enRoute', ''], failed: ['virements.echoue', 'rouge'], canceled: ['virements.echoue', 'rouge'] };
  return (
    <section className="ec-virements">
      <div className="ec-vir-prochain">
        <small>{t('virements.prochain')}</small>
        <b>{eur(prochain.montant)}</b>
        <span>{t('virements.prochainQuand', { jour: jourLong(lundi) })}</span>
      </div>
      <p className="ec-feuille-titre">{t('virements.chaqueLundi')}</p>
      <p className="ec-aide">{t('virements.toucheSemaine')}</p>
      <Semaine t={t} ouvertDepart titre={majuscule(jourLong(lundi))} sous={t('virements.depuisDernier')} montant={prochain.montant}
        etat={{ texte: t('virements.aVenir'), classe: '' }} lignes={prochain.lignes} comptoir={prochain.comptoir} />
      {d.versements.map((v) => {
        const [cle, classe] = STATUT[v.statut] || ['virements.enRoute', ''];
        return (
          <Semaine key={v.id} t={t} ouvertDepart={false} titre={majuscule(jourLong(v.arrivee))} sous={t('virements.arriveLe')}
            montant={v.montant} etat={{ texte: t(cle), classe }} lignes={v.lignes} />
        );
      })}
      {!d.stripe && <p className="ec-aide">{t('virements.sansStripe')}</p>}
    </section>
  );
}
