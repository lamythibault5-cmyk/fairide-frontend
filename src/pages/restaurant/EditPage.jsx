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
import EcranCapacite from '../../components/commerce/EcranCapacite';
import { restaurantTypeLabel } from '../../menuCategories';
import { cuisinesCommerce } from '../../specialites';
import EcranSuppression from '../../components/commerce/EcranSuppression';
import { BandeauCommerce, FeuilleCommerce } from '../../components/commerce/BandeauCommerce';
import { useAuth } from '../../context/AuthContext';
import { RouteMiseEnLigne, EtapesMiseEnLigne } from '../../components/commerce/MiseEnLigne';
import useMiseEnLigne from '../../components/commerce/useMiseEnLigne';
import { experienceApp } from '../../natif';
import { imgProps, cacherImageCassee } from '../../images';
import Icone from '../../components/Icone';
import { BandeauSoir, TuilesCommerce } from '../../components/commerce/CeSoir';
import { euros } from '../../prixPlat';

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
// BANDEAU IRIS (fondateur, 2026-10-16, maquettes/tous-les-ecrans/tous-les-ecrans.html › Mon commerce) : le nom, l'état en ligne et la
// route vers la mise en ligne sur le bandeau (le vélo sur l'étape en cours) ; dans la feuille, la prochaine étape et son
// bouton lime, les autres étapes, puis les blocs communs du tableau de bord et les rangées ci-dessous.
// SUR LE SITE (2026-10-16, maquettes/site-ordinateur/site-ordinateur.html › Mon commerce, lot « pro ») : une vue d'ensemble sur deux colonnes.
// À gauche, la prochaine étape (le bouton lime dans sa carte), les autres étapes, puis les rangées ; à droite, « Ta fiche,
// comme les clients la verront » et deux tuiles (la carte, les horaires du jour) qui mènent à leur modification. La route
// du bandeau porte le nom de chaque arrêt. Sur une feuille étroite (téléphone), tout s'empile : étapes, fiche, rangées.
// L'app garde sa colonne unique, inchangée.
const SITE = !experienceApp();

const ECRANS = {
  identite: EcranIdentite, contact: EcranContact, adresse: EcranAdresse, horaires: EcranHoraires,
  fermetures: EcranFermetures, legal: EcranLegal, livraison: EcranLivreurs, offre: EcranOffreLivraison,
  type: EcranTypeCommerce, suppression: EcranSuppression, capacite: EcranCapacite
};

function aujourdhuiIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EditPage() {
  const { t } = useLanguage();
  const { restaurant, orders, drivers, restoId, loadDashboard, communs, onConnect, connecting, lectureSeule } = useOutletContext();
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
  /* CE QUI EST VRAIMENT EN LIGNE (audit design 2, 2026-10-19 : la vraie fiche de Maestro disait « En ligne » à côté de
     « 3 étapes faites sur 6 », contrat et paiements encore ouverts). Visible dans la liste ne veut pas dire tout vendre :
     sans paiements Stripe actifs, rien ne se paie en ligne (routes/orders.js) — il ne reste que l'à emporter payé au
     comptoir, si le commerce l'accepte. On dit donc ce qui marche aujourd'hui. */
  const paiementsActifs = r.stripeConnectStatus === 'active' || r.onboarding?.paymentsRequired === false;
  const comptoir = (r.offersPickup ?? r.wantsPickup) && r.pickupPaymentMode !== 'online';
  // Visible mais commandes fermées par l'interrupteur (« Fermer jusqu'à réouverture », ou commerce créé fermé à
  // l'inscription faute d'horaires) : il n'est PAS dans la liste des clients (audit du 19/10, shop-304), on ne dit plus « En ligne ».
  const etatEnLigne = !r.publicListed ? t('ecranCommerce.pasEnLigne')
    : r.open === false ? t('ecranCommerce.enLigneFerme')
    : paiementsActifs ? t('ecranCommerce.enLigne')
      : comptoir ? t('serviceCommerce.visibleComptoir') : t('serviceCommerce.visibleFerme');
  // Les outils du quotidien (Statistiques, Promotions, Factures ; plus d'Avis depuis le 22/10/2026), en tuiles sous la mise en ligne.
  const tuiles = <TuilesCommerce restaurant={r} orders={orders} restoId={restoId} token={token} />;
  const ligne = (cle, props) => <LigneCompte {...props} onClick={() => setOuvert(cle)} />;

  // Ce que le commerce vend : ses spécialités dans l'ordre, la première étant celle de sa fiche (EcranTypeCommerce.jsx).
  const type = cuisinesCommerce(r).map((c) => restaurantTypeLabel(c, t) || c).join(', ');
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

    {/* « Ta fiche » (audit design 2) : ce que les clients voient du commerce, sous les outils du quotidien. */}
    <p className="ec-feuille-titre">{t('serviceCommerce.taFiche')}</p>
    <div className="card account-groupe" aria-label={t('serviceCommerce.taFiche')}>
      {ligne('identite', { icone: 'commerce', titre: t('editResto.rowIdentity'), sous: r.name })}
      {ligne('adresse', { icone: 'position', titre: t('editResto.address'), sous: adresse || aCompleter, accent: adresse ? undefined : 'warn' })}
      {ligne('horaires', { icone: 'horloge', titre: t('editResto.openingHours'), sous: horairesDuJour ? t('editResto.todayHours', { hours: horairesDuJour }) : aCompleter, accent: r.hours ? undefined : 'warn' })}
      {ligne('fermetures', { icone: 'porte', titre: t('editResto.rowClosures'), sous: fermeturesAVenir ? t('editResto.closuresCount', { n: fermeturesAVenir }) : t('editResto.closuresNone') })}
      {ligne('contact', { icone: 'telephone', titre: t('editResto.rowContact'), sous: contact || aCompleter })}
    </div>

    <p className="ec-feuille-titre">{t('editResto.delivery')}</p>
    <div className="card account-groupe" aria-label={t('editResto.delivery')}>
      {ligne('livraison', { icone: 'velo', titre: t('editResto.delivery'), sous: r.deliveryMode === 'own' ? t('editResto.deliveryOwn', { n: drivers.filter((d) => d.status !== 'invited').length }) : t('editResto.deliveryPool') })}
      {ligne('offre', { icone: 'etiquette', titre: t('editResto.rowDeliveryOffer'), sous: offre })}
      {/* Distance de livraison et plafond de commandes par jour (fondateur, 2026-10-01) : pas de limite par défaut. */}
      {/* Le temps de préparation et le minimum de commande, réglés sur le même écran, s'ajoutent au résumé quand ils sont
          posés (audit du 19/10, shop-331). */}
      {ligne('capacite', { icone: 'reglages', titre: t('editResto.rowCapacity'), sous: [
        r.deliveryRadiusKm == null && r.maxOrdersPerDay == null ? t('editResto.capacitySubNone', { km: 6 }) : [r.deliveryRadiusKm != null && t('editResto.capacitySubRadius', { km: String(r.deliveryRadiusKm).replace('.', ',') }), r.maxOrdersPerDay != null && t('editResto.capacitySubCap', { n: r.maxOrdersPerDay })].filter(Boolean).join(' · '),
        r.prepMinutes != null && t('editResto.capacitySubPrep', { n: r.prepMinutes }),
        r.minOrderAmount != null && t('editResto.capacitySubMin', { amount: euros(r.minOrderAmount) })
      ].filter(Boolean).join(' · ') })}
    </div>

    <p className="ec-feuille-titre">{t('editResto.rowLegal')}</p>
    <div className="card account-groupe" aria-label={t('editResto.rowLegal')}>
      {ligne('legal', { icone: 'document', titre: t('editResto.rowLegal'), sous: legalManquant ? aCompleter : `BCE ${r.companyNumber}`, accent: legalManquant ? 'warn' : undefined })}
      {/* Les libellés dans la langue choisie, plus les valeurs françaises brutes (audit du 19/10, shop-317). Une seule ligne
          depuis le 2026-10-22 : « Type de commerce » et « Autres types de cuisine » sont devenus le même écran. */}
      {ligne('type', { icone: 'restaurants', titre: t('specialites.groupe'), sous: type })}
    </div>
    </>
  );
  return (
    <div>
      <BandeauCommerce route={!etapes}>
        {etapes ? (
          <>
            <div className="ec-b-haut">
              <span><b>{r.name}</b>{type || r.commune ? ' · ' : ''}{[type, r.commune].filter(Boolean).join(' · ')}</span>
              <span className="ec-chip">{etatEnLigne}</span>
            </div>
            <h1 className="ec-b-titre">{t('miseEnLigne.title')}</h1>
            <p className="ec-b-sous">{t('miseEnLigne.progress', { n: etapes.faites, total: etapes.etapes.length })}</p>
            <RouteMiseEnLigne etapes={etapes.etapes} libelles={SITE} />
          </>
        ) : <BandeauSoir restaurant={r} orders={orders} />}
      </BandeauCommerce>
      <FeuilleCommerce>
      {SITE ? (
        <div className="sp-cadre"><div className="sp-ensemble">
          <div className="sp-ensemble-etapes">{etapes && <EtapesMiseEnLigne etat={etapes} boutonDansCarte />}{tuiles}</div>
          {apercu}
          <div className="sp-ensemble-reste">{rangees}</div>
        </div></div>
      ) : (
        <>
          {etapes && <EtapesMiseEnLigne etat={etapes} />}
          {tuiles}
          {rangees}
        </>
      )}
      </FeuilleCommerce>

      {/* « Supprimer ce restaurant » vit dans Infos légales (audit design 2) : jamais en vue sur l'écran du service. */}
      {Ecran && <Ecran restaurant={r} drivers={drivers} restoId={restoId} loadDashboard={loadDashboard} onFermer={() => setOuvert(null)}
        onSupprimer={ouvert === 'legal' ? () => setOuvert('suppression') : undefined} />}
    </div>
  );
}
