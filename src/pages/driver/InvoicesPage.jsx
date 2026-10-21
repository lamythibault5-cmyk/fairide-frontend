import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { SkeletonCards } from '../../components/Skeleton';
import InvoiceArchive from '../../components/InvoiceArchive';
import { euros } from '../../prixPlat';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import EtatVide from '../../components/EtatVide';
import ErreurChargement from '../../components/ErreurChargement';
import { experienceApp } from '../../natif';
import PageLivreur from '../../components/livreur/PageLivreur';

/* LA COURSE COMPTE AU MOIS OÙ ELLE A ÉTÉ REMISE, À BRUXELLES (audit du 19/10, courier-20). Le récap lisait l'heure de création
 * en UTC (`toISOString`) : une course créée le 31 à 23:50 et livrée le 1er à 00:20 tombait le mauvais mois. Et il ne gardait
 * que le statut « livrée » : une course close « client absent » ou remise refusée, payée pourtant, manquait aux sommes reçues
 * (`driverPaidRide`, serveur). */
const quandRemise = (o) => o.deliveredAt || o.createdAt;
const moisBruxelles = (ts) => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' }).slice(0, 7);
const coursePayee = (o) => (o.driverPaidRide !== undefined ? o.driverPaidRide : o.status === 'livre');

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Récap mensuel imprimable des sommes reçues (frais de livraison + pourboires) — pas une facture TVA
// (la plupart des livreurs sont des particuliers), mais un justificatif de paiement clair pour leur
// propre suivi, dans le même esprit que le récap de commission côté restaurant.
export default function InvoicesPage() {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [orders, setOrders] = useState(null);
  const [month, setMonth] = useState(currentMonthValue());
  // Un premier chargement raté ne laisse plus le squelette pour toujours : « Impossible de charger » + Réessayer (audit du 19/10, CROSS-33).
  const [erreur, setErreur] = useState(null);
  const charger = useCallback(() => {
    setErreur(null);
    api('/orders/mine/deliveries', { token }).then(setOrders).catch(setErreur);
  }, [token]);

  useEffect(() => { charger(); }, [charger]);

  const monthOrders = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter((o) => coursePayee(o) && moisBruxelles(quandRemise(o)) === month)
      .sort((a, b) => quandRemise(a) - quandRemise(b));
  }, [orders, month]);
  const totals = useMemo(() => ({
    deliveryFees: monthOrders.reduce((a, o) => a + Number(o.driverFee ?? o.deliveryFee), 0),
    tips: monthOrders.reduce((a, o) => a + o.tipAmount, 0)
  }), [monthOrders]);

  // BANDEAU ET FEUILLE, DANS L'APP AUSSI (fondateur, 2026-10-19, finitions-appli.html, section 4) : « ← Mon compte » et le
  // titre sur le bandeau iris ; dans la feuille, des titres de section en petites capitales et des lignes à filet au lieu des
  // cartes encadrées. Le tableau des relevés (InvoiceArchive, partagé avec le commerce) n'est pas touché : sur un téléphone,
  // ecran-livreur.css en fait une ligne par relevé, et ses colonnes sans en-tête y reprennent leur libellé par les variables
  // ci-dessous (--ecl-lib-*), traduites ici. Mêmes actions qu'avant : PDF, mois, Imprimer (site).
  const libelles = {
    '--ecl-lib-numero': JSON.stringify(`${t('invoiceArchive.number')} `),
    '--ecl-lib-emise': JSON.stringify(`${t('invoiceArchive.issuedOn')} `),
    '--ecl-lib-ht': JSON.stringify(`${t('invoiceArchive.amountExVat')} `),
    '--ecl-lib-tva': JSON.stringify('TVA ')
  };
  return (
    <PageLivreur classe="ecl-factures" bandeauApp retourCompte titre={t('invoicesDriver.title')} sous={t('siteLivreur.facturesSous')}>
      <div style={libelles}>
      {!orders && erreur ? <ErreurChargement erreur={erreur} onReessayer={charger} /> : !orders ? <SkeletonCards count={3} /> : (
      <>

      {/* Relevés mensuels des ventes encaissées pour son compte (fondateur, 2026-10-14 : plus des autofacturations,
          art. 53 §2 C.TVA) : pièce de son journal des recettes (AR n°1 art. 14), pas une facture — ni UBL ni Peppol.
          Le récap mensuel plus bas reste un outil de suivi personnel, calculé à la volée. */}
      <InvoiceArchive
        endpoint="/invoices/driver"
        pdfPath={(inv) => `/invoices/driver/${inv.id}/pdf`}
        peppol={false}
        titre={t('invoicesDriver.selfBilling')}
        description={t('invoicesDriver.selfBillingDesc')}
        colonneMontant="Total"
      />

      <section className="no-print">
        <h2 className="ecl-titre-sec">{t('invoicesDriver.paymentsSummary')}</h2>
        <p className="small ecl-factures-intro">{t('invoicesDriver.intro')}</p>
        <div className="ecl-factures-mois">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label={t('invoicesDriver.paymentsSummary')} />
          {/* Imprimer n'existe pas dans l'application (WebView) : le bouton n'y faisait rien. */}
          {!experienceApp() && <button type="button" className="btn-teal" onClick={() => window.print()}>{t('invoicesDriver.print')}</button>}
        </div>
      </section>

      {/* Le récap imprimable : le nom, le mois, puis une ligne à filet par course livrée (date, commerce, frais, pourboire). */}
      <section className="ecl-recap">
        <div className="ecl-recap-qui">
          <b>{user?.name}</b>
          {user?.email && <span className="small">{user.email}</span>}
        </div>
        <h3 className="ecl-recap-mois">{t('invoicesDriver.paymentsReceived', { month: new Date(`${month}-01`).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' }) })}</h3>
        {monthOrders.length === 0 && <EtatVide icone="document" titre={t('invoicesDriver.none')} />}
        {monthOrders.length > 0 && (
          <table className="ecl-recap-table">
            <thead>
              <tr>
                <th>{t('invoicesDriver.date')}</th>
                <th>{t('invoicesDriver.restaurant')}</th>
                <th className="num">{t('invoicesDriver.deliveryFee')}</th>
                <th className="num">{t('invoicesDriver.tip')}</th>
              </tr>
            </thead>
            <tbody>
              {monthOrders.map((o) => (
                <tr key={o.id}>
                  <td>{new Date(quandRemise(o)).toLocaleDateString(getLocale())}</td>
                  <td>{o.restaurantName}</td>
                  <td className="num">{euros(Number(o.driverFee ?? o.deliveryFee))}</td>
                  <td className="num">{o.tipAmount > 0 ? euros(o.tipAmount) : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>{t('invoicesDriver.total')}</td>
                <td className="num">{euros(totals.deliveryFees)}</td>
                <td className="num">{euros(totals.tips)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
      </>
      )}
      </div>
    </PageLivreur>
  );
}
