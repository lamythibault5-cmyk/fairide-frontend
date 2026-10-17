import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { DAY_KEYS, formatDaySchedule } from '../../openingHours';
import LigneCompte from '../../components/LigneCompte';
import EcranIdentite from '../../components/commerce/EcranIdentite';
import EcranContact from '../../components/commerce/EcranContact';
import EcranAdresse from '../../components/commerce/EcranAdresse';
import EcranHoraires from '../../components/commerce/EcranHoraires';
import EcranFermetures from '../../components/commerce/EcranFermetures';
import EcranLegal from '../../components/commerce/EcranLegal';
import EcranLivreurs from '../../components/commerce/EcranLivreurs';
import EcranOffreLivraison from '../../components/commerce/EcranOffreLivraison';
import EcranTypeCommerce from '../../components/commerce/EcranTypeCommerce';
import EcranCuisines from '../../components/commerce/EcranCuisines';
import EcranCapacite from '../../components/commerce/EcranCapacite';
import { restaurantTypeLabel } from '../../menuCategories';
import EcranSuppression from '../../components/commerce/EcranSuppression';
import { BandeauCommerce, FeuilleCommerce } from '../../components/commerce/BandeauCommerce';
import { useAuth } from '../../context/AuthContext';
import { RouteMiseEnLigne, EtapesMiseEnLigne } from '../../components/commerce/MiseEnLigne';
import useMiseEnLigne from '../../components/commerce/useMiseEnLigne';
import { experienceApp } from '../../natif';
import { imgProps, cacherImageCassee } from '../../images';
import Icone from '../../components/Icone';

// « Mon commerce » : une rangée par sujet, qui dit l'état actuel, et un sous-écran pour le changer.
//
// POURQUOI (2026-09-23). C'était un seul formulaire de 33 champs — nom, entreprise, AFSCA, alcool,
// téléphones, e-mails, site, adresse, description, photos, horaires, fermetures, type, suppression,
// livreurs, remise sur la livraison — avec un seul « Enregistrer » au milieu, qui renvoyait tout et
// refusait un changement d'horaires tant que le n° de TVA manquait. Le motif est celui du paiement
// (components/SousEcran.jsx, Checkout.jsx), repris d'Uber Eats : chaque rangée résume une décision déjà
// prise (« Av. Louise 12, 1050 Ixelles ») et n'ouvre que ce qu'on veut corriger. Chaque sous-écran
// n'envoie que ses propres champs (voir commerce/useEnregistrerCommerce.js).
//
// Un sous-écran est monté à l'ouverture et démonté à la fermeture : ses champs partent de `restaurant`
// une seule fois, et le rafraîchissement du tableau de bord toutes les 15 s n'efface plus une saisie.
//
// BANDEAU IRIS (fondateur, 2026-10-16, mockups/tous-les-ecrans.html › Mon commerce) : le nom, l'état en ligne et la
// route vers la mise en ligne sur le bandeau (le vélo sur l'étape en cours) ; dans la feuille, la prochaine étape et son
// bouton lime, les autres étapes, puis les blocs communs du tableau de bord et les rangées ci-dessous.
// SUR LE SITE (2026-10-16, mockups/site-ordinateur.html › Mon commerce, lot « pro ») : une vue d'ensemble sur deux colonnes.
// À gauche, la prochaine étape (le bouton lime dans sa carte), les autres étapes, puis les rangées ; à droite, « Ta fiche,
// comme les clients la verront » et deux tuiles (la carte, les horaires du jour) qui mènent à leur modification. La route
// du bandeau porte le nom de chaque arrêt. Sur une feuille étroite (téléphone), tout s'empile : étapes, fiche, rangées.
// L'app garde sa colonne unique, inchangée.
const SITE = !experienceApp();

const ECRANS = {
  identite: EcranIdentite, contact: EcranContact, adresse: EcranAdresse, horaires: EcranHoraires,
  fermetures: EcranFermetures, legal: EcranLegal, livraison: EcranLivreurs, offre: EcranOffreLivraison,
  type: EcranTypeCommerce, cuisines: EcranCuisines, suppression: EcranSuppression, capacite: EcranCapacite
};

function aujourdhuiIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EditPage() {
  const { t } = useLanguage();
  const { restaurant, drivers, restoId, loadDashboard, communs, onConnect, connecting, lectureSeule } = useOutletContext();
  const { token } = useAuth();
  const [ouvert, setOuvert] = useState(null);
  const etapes = useMiseEnLigne({ restaurant, restoId, token, onConnect, connecting, onChange: () => loadDashboard(restoId), lectureSeule });

  if (!restaurant) return null;
  const r = restaurant;
  const aCompleter = t('editResto.toComplete');

  const adresse = [[r.addressStreet, r.addressNumber].filter(Boolean).join(' '), [r.addressPostalCode, r.commune].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const contact = [r.phone, r.email].filter(Boolean).join(' · ');
  const horairesDuJour = r.hours ? formatDaySchedule(r.hours, DAY_KEYS[new Date().getDay()], t) : null;
  const iso = aujourdhuiIso();
  const fermeturesAVenir = (r.closures || []).filter((c) => !c.endDate || c.endDate >= iso).length;
  const legalManquant = !r.legalName || !r.companyNumber || !r.vatNumber || !r.responsibleName;
  const offre = r.freeDelivery ? t('editResto.offerFree')
    : r.freeDeliveryMinOrder != null ? t('editResto.offerFromMin', { amount: r.freeDeliveryMinOrder })
    : Number(r.deliveryFeeDiscount) > 0 ? t('editResto.offerDiscount', { amount: r.deliveryFeeDiscount })
    : t('editResto.offerNone');

  const Ecran = ouvert ? ECRANS[ouvert] : null;
  const ligne = (cle, props) => <LigneCompte {...props} onClick={() => setOuvert(cle)} />;

  const type = restaurantTypeLabel(r.cuisine, t) || r.cuisine;
  const nbPlats = (r.menu || []).length;
  // La fiche telle que la liste des commerces la montre : photo de couverture, nom, type · commune · horaires du jour.
  const apercu = SITE && (
    <aside className="sp-apercu" aria-label={t('sitePro.ficheTitre')}>
      <p className="ec-feuille-titre">{t('sitePro.ficheTitre')}</p>
      <div className="sp-fiche">
        <div className="sp-fiche-photo">
          {r.coverImageUrl
            ? <img {...imgProps(r.coverImageUrl, 380, '380px')} alt="" onError={cacherImageCassee} />
            : <span><Icone nom="apercu" taille={20} />{t('sitePro.photoAbsente')}</span>}
        </div>
        <div className="sp-fiche-corps">
          <b>{r.name}</b>
          <span className="small">{[type, r.commune, horairesDuJour].filter(Boolean).join(' · ')}</span>
          <div className="sp-fiche-liens">
            <button type="button" className="sp-lien" onClick={() => setOuvert('identite')}>{t('sitePro.modifierFiche')}</button>
            <Link to="/dashboard/preview" className="sp-lien">{t('sitePro.voirCommeClient')}</Link>
          </div>
        </div>
      </div>
      <div className="sp-tuiles">
        <Link to="/dashboard/menu" className="sp-tuile">
          <small>{t('sitePro.tuileCarte')}</small>
          <b>{t(nbPlats === 1 ? 'sitePro.plat' : 'sitePro.plats', { n: nbPlats })}</b>
          <span className="sp-lien">{t('sitePro.modifier')}</span>
        </Link>
        <button type="button" className="sp-tuile" onClick={() => setOuvert('horaires')}>
          <small>{t('sitePro.tuileHoraires')}</small>
          <b>{horairesDuJour || aCompleter}</b>
          <span className="sp-lien">{t('sitePro.modifier')}</span>
        </button>
      </div>
    </aside>
  );
  // Les blocs communs puis les rangées (le commerce, la livraison, le légal) : sous les étapes, dans les deux mises en page.
  const rangees = (
    <>
    {communs}

    <p className="ec-feuille-titre">{t('editResto.groupShop')}</p>
    <div className="card account-groupe" aria-label={t('editResto.groupShop')}>
      {ligne('identite', { icone: 'commerce', titre: t('editResto.rowIdentity'), sous: r.name })}
      {ligne('adresse', { icone: 'position', titre: t('editResto.address'), sous: adresse || aCompleter, accent: adresse ? undefined : 'warn' })}
      {ligne('horaires', { icone: 'horloge', titre: t('editResto.openingHours'), sous: horairesDuJour ? t('editResto.todayHours', { hours: horairesDuJour }) : aCompleter, accent: r.hours ? undefined : 'warn' })}
      {ligne('fermetures', { icone: 'porte', titre: t('editResto.rowClosures'), sous: fermeturesAVenir ? t('editResto.closuresCount', { n: fermeturesAVenir }) : t('editResto.closuresNone') })}
      {ligne('contact', { icone: 'telephone', titre: t('editResto.rowContact'), sous: contact || aCompleter })}
    </div>

    <p className="ec-feuille-titre">{t('editResto.delivery')}</p>
    <div className="card account-groupe" aria-label={t('editResto.delivery')}>
      {ligne('livraison', { icone: 'scooter', titre: t('editResto.delivery'), sous: r.deliveryMode === 'own' ? t('editResto.deliveryOwn', { n: drivers.length }) : t('editResto.deliveryPool') })}
      {ligne('offre', { icone: 'etiquette', titre: t('editResto.rowDeliveryOffer'), sous: offre })}
      {/* Distance de livraison et plafond de commandes par jour (fondateur, 2026-10-01) : pas de limite par défaut. */}
      {ligne('capacite', { icone: 'reglages', titre: t('editResto.rowCapacity'), sous: r.deliveryRadiusKm == null && r.maxOrdersPerDay == null ? t('editResto.capacitySubNone', { km: 6 }) : [r.deliveryRadiusKm != null && t('editResto.capacitySubRadius', { km: String(r.deliveryRadiusKm).replace('.', ',') }), r.maxOrdersPerDay != null && t('editResto.capacitySubCap', { n: r.maxOrdersPerDay })].filter(Boolean).join(' · ') })}
    </div>

    <p className="ec-feuille-titre">{t('editResto.rowLegal')}</p>
    <div className="card account-groupe" aria-label={t('editResto.rowLegal')}>
      {ligne('legal', { icone: 'document', titre: t('editResto.rowLegal'), sous: legalManquant ? aCompleter : `BCE ${r.companyNumber}`, accent: legalManquant ? 'warn' : undefined })}
      {ligne('type', { icone: 'restaurants', titre: t('editResto.rowType'), sous: r.cuisine })}
      {ligne('cuisines', { icone: 'restaurants', titre: t('editResto.rowCuisines'), sous: (r.extraCuisines || []).length ? (r.extraCuisines || []).map((c) => restaurantTypeLabel(c, t) || c).join(', ') : t('editResto.cuisinesNone') })}
      {ligne('suppression', { icone: 'interdit', titre: t('editResto.deleteTitle'), danger: true })}
    </div>
    </>
  );
  return (
    <div>
      <BandeauCommerce>
        <div className="ec-b-haut">
          {/* Sans étape restante, le nom devient le titre : il n'est pas répété au-dessus. */}
          <span>{etapes && <><b>{r.name}</b>{type || r.commune ? ' · ' : ''}</>}{[type, r.commune].filter(Boolean).join(' · ')}</span>
          <span className="ec-chip">{r.publicListed ? t('ecranCommerce.enLigne') : t('ecranCommerce.pasEnLigne')}</span>
        </div>
        <h1 className="ec-b-titre">{etapes ? t('miseEnLigne.title') : r.name}</h1>
        {etapes && <p className="ec-b-sous">{t('miseEnLigne.progress', { done: etapes.faites, total: etapes.etapes.length })}</p>}
        {etapes && <RouteMiseEnLigne etapes={etapes.etapes} libelles={SITE} />}
      </BandeauCommerce>
      <FeuilleCommerce>
      {SITE ? (
        <div className="sp-cadre"><div className="sp-ensemble">
          <div className="sp-ensemble-etapes">{etapes && <EtapesMiseEnLigne etat={etapes} boutonDansCarte />}</div>
          {apercu}
          <div className="sp-ensemble-reste">{rangees}</div>
        </div></div>
      ) : (
        <>
          {etapes && <EtapesMiseEnLigne etat={etapes} />}
          {rangees}
        </>
      )}
      </FeuilleCommerce>

      {Ecran && <Ecran restaurant={r} drivers={drivers} restoId={restoId} loadDashboard={loadDashboard} onFermer={() => setOuvert(null)} />}
    </div>
  );
}
