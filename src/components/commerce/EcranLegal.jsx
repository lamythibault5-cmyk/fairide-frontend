import { useId, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';
import BoutonEnregistrer from './BoutonEnregistrer';
import useEnregistrerCommerce from './useEnregistrerCommerce';
import Icone from '../Icone';

// Mon commerce › Infos légales : l'entreprise (nom légal, BCE, TVA, responsable) et la sécurité
// alimentaire (AFSCA, vente d'alcool). Ces numéros partent vers le contrat, les factures de commission
// et le KYB Stripe ; le serveur vérifie leur clé de contrôle (voir identiteEntreprise.js).
//
// L'engagement de vérifier l'âge ne se décoche pas une fois donné : le serveur l'horodate et ne le
// retire que si le commerce cesse de vendre de l'alcool.
export default function EcranLegal({ restaurant, restoId, loadDashboard, onFermer, onSupprimer }) {
  const { t } = useLanguage();
  const toast = useToast();
  const ids = useId();
  const [nomLegal, setNomLegal] = useState(restaurant.legalName || '');
  const [bce, setBce] = useState(restaurant.companyNumber || '');
  const [tva, setTva] = useState(restaurant.vatNumber || '');
  const [responsable, setResponsable] = useState(restaurant.responsibleName || '');
  const [afsca, setAfsca] = useState(restaurant.afscaNumber || '');
  // Plus modifiables ici (pas d'alcool sur Fairide) : renvoyées telles quelles à l'enregistrement.
  const alcool = !!restaurant.sellsAlcohol;
  const engagementAge = !!restaurant.alcoholAgeAckAt;
  const { enregistrer, enCours } = useEnregistrerCommerce({ restoId, loadDashboard, onFermer });

  // Contrat signé ou paiements Stripe actifs : ces numéros y sont inscrits. Un changement reste possible, mais l'équipe en est
  // avertie (tâche côté serveur) et le commerce le sait avant d'enregistrer (audit du 19/10, shop-305).
  const identiteEngagee = !!restaurant.onboarding?.contractAccepted || restaurant.stripeConnectStatus === 'active';
  const modifie = nomLegal !== (restaurant.legalName || '') || bce !== (restaurant.companyNumber || '') || tva !== (restaurant.vatNumber || '')
    || responsable !== (restaurant.responsibleName || '') || afsca !== (restaurant.afscaNumber || '');

  function valider() {
    if (!nomLegal.trim() || !bce.trim() || !tva.trim() || !responsable.trim()) { toast(t('editResto.toastLegalRequired'), 'erreur'); return; }
    enregistrer({
      legalName: nomLegal.trim(), companyNumber: bce.trim(), vatNumber: tva.trim(), responsibleName: responsable.trim(),
      afscaNumber: afsca.trim(), sellsAlcohol: alcool, alcoholAgeAck: engagementAge
    });
  }

  return (
    <SousEcran titre={t('editResto.rowLegal')} onFermer={onFermer} pied={<BoutonEnregistrer enCours={enCours} onClick={valider} />} modifie={modifie}>
      {identiteEngagee && <p className="small" style={{ margin: '0 0 12px', color: 'var(--ink-soft)' }}>{t('editResto.legalChangeNotice')}</p>}
      <div className="field"><label htmlFor={ids + '-nl'}>{t('editResto.legalName')}</label><input id={ids + '-nl'} value={nomLegal} onChange={(e) => setNomLegal(e.target.value)} placeholder={t('editResto.phLegalName')} /></div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={ids + '-bce'}>{t('editResto.companyNumber')}</label>
          <input id={ids + '-bce'} value={bce} onChange={(e) => setBce(e.target.value)} placeholder="0123.456.789" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={ids + '-tva'}>{t('editResto.vatNumber')}</label>
          <input id={ids + '-tva'} value={tva} onChange={(e) => setTva(e.target.value)} placeholder={t('editResto.phVat')} />
        </div>
      </div>
      <div className="field"><label htmlFor={ids + '-resp'}>{t('editResto.manager')}</label><input id={ids + '-resp'} value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder={t('editResto.phManager')} /></div>

      <div className="divider" />
      <div className="field">
        <label htmlFor={ids + '-afsca'}>{t('editResto.afscaNumber')}</label>
        <input id={ids + '-afsca'} value={afsca} onChange={(e) => setAfsca(e.target.value)} placeholder="2123.456.789" inputMode="numeric" />
        <span className="small">{t('editResto.afscaHelp')}</span>
      </div>
      {/* Pas d'alcool sur Fairide (fondateur, 17 et 18/10/2026) : plus de case « Ma carte contient des boissons alcoolisées »
          ni d'engagement d'âge à cocher, la règle est dite. Les valeurs déjà enregistrées repartent telles quelles. */}
      <div className="field">
        <span className="small">{t('editResto.noAlcoholRule')}</span>
      </div>
      {/* Supprimer le commerce : ici, au fond des infos légales, plutôt qu'en rouge sur l'accueil (audit design 2, 2026-10-19).
          Ouvre le même écran qu'avant (EcranSuppression : motif, code envoyé par l'équipe). */}
      {onSupprimer && (
        <>
          <div className="divider" />
          <button type="button" className="btn-ghost" style={{ color: 'var(--red)', paddingLeft: 0 }} onClick={onSupprimer}>
            <Icone nom="interdit" taille={16} className="icone-texte" />{' '}{t('editResto.deleteTitle')}
          </button>
        </>
      )}
    </SousEcran>
  );
}
