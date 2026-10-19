import { ouvrirPdfBlob } from '../../natif';

// Ce que le dossier livreur du site (Onboarding.jsx) et celui de l'application (DossierAppli.jsx) partagent : les listes
// et règles du dossier, écrites une seule fois pour que les deux ne divergent jamais.

// « statut_non_verifie » n'est pas une action du livreur : c'est Fairide qui vérifie. Il n'empêche
// donc pas d'envoyer le dossier, il est simplement affiché à titre d'information.
export const MANQUES_INFORMATIFS = ['statut_non_verifie'];
// Peuvent manquer à l'envoi du dossier (fondateur, 18/10/2026) : le numéro d'entreprise, et le n° de TVA qui en découle.
// L'inscription à la BCE prend des jours ; l'équipe vérifie le reste pendant ce temps, et le numéro reste exigé avant la
// validation (serveur : routes/couriers.js, MANQUES_APRES_ENVOI).
export const MANQUES_APRES_ENVOI = ['bce', 'tva_numero'];
// Échecs de Stripe Identity que l'on sait expliquer (code renvoyé par le serveur, courier.identity.error).
export const ERREURS_IDENTITE = ['document_expired', 'document_unverified_other', 'document_type_not_supported', 'selfie_face_mismatch', 'selfie_document_missing_photo', 'selfie_unverified_other', 'under_supported_age', 'consent_declined'];
// Caisses d'assurances sociales agréées en Belgique (noms propres, pas de traduction).
export const CAISSES = ['Liantis', 'Acerta', 'Xerius', 'Partena', 'Securex', 'UCM', 'Group S', 'Caisse nationale auxiliaire'];
// Attestations d'assurance, permis, titre de séjour : date d'échéance demandée, Fairide rappelle le renouvellement.
// Carte professionnelle (CODE-14) : sa date d'expiration est exigée — sans carte valide, un livreur hors UE ne prend pas de course.
export const AVEC_ECHEANCE = ['liability_insurance', 'vehicle_insurance', 'driving_licence', 'residence_permit', 'professional_card'];
// Date exigée AVANT le dépôt : sans elle, le titre de séjour ne compte pas (routes/couriers.js) et la carte professionnelle est
// refusée par le serveur. Le champ date était commun à toutes les pièces et sans libellé visible (seulement une infobulle) :
// un titre déposé sans date restait « manquant » sans explication (audit UX du 15/10/2026).
export const ECHEANCE_REQUISE = ['residence_permit', 'professional_card'];

// Pièces à déposer : photo de profil pour tous, pièces du statut, puis permis / immatriculation / assurance pour un véhicule
// motorisé ; hors EEE (B2), titre de séjour (avec échéance) et carte professionnelle d'indépendant.
export function documentsRequis(d, { statusType, motorise, horsEee }) {
  return [...new Set([
    ...(d.commonDocuments ?? ['profile_photo']),
    ...(d.requiredDocuments?.[statusType] ?? []),
    ...(motorise ? (d.motorizedDocuments ?? ['driving_licence', 'vehicle_registration', 'vehicle_insurance']) : []),
    ...(horsEee ? ['residence_permit', 'professional_card'] : [])
  ])];
}

// Le formulaire « Infos » tel que le serveur l'attend (PATCH /couriers/me) : oui / non en booléen, rien de vide.
export function corpsInfos(f) {
  const body = { ...f };
  if (!body.nationalNumber) delete body.nationalNumber;
  if (!body.bagOption) delete body.bagOption;
  if (body.worksOtherPlatforms === 'yes' || body.worksOtherPlatforms === 'no') body.worksOtherPlatforms = body.worksOtherPlatforms === 'yes'; else delete body.worksOtherPlatforms;
  if (!body.nationalityGroup) delete body.nationalityGroup;
  for (const k of Object.keys(body)) if (body[k] === null) delete body[k];
  return body;
}

// Valeurs de départ du formulaire « Infos », reprises du dossier.
export function infosDepuisDossier(c) {
  return {
    birthDate: c.birthDate ?? '', nationalNumber: '', zone: c.zone || c.preferredZones?.[0] || '',
    worksOtherPlatforms: c.otherPlatforms?.works === true ? 'yes' : c.otherPlatforms?.works === false ? 'no' : '', vehicleType: c.vehicleType ?? '', licenceNumber: c.licenceNumber ?? '', licencePlate: c.licencePlate ?? '', bagOption: c.bag?.option || '',
    schoolName: c.student?.school ?? '', academicYear: c.student?.academicYear ?? '',
    socialInsuranceFund: c.socialInsuranceFund ?? c.student?.socialInsuranceFund ?? '',
    companyNumber: c.independent?.companyNumber ?? '', vatStatus: c.independent?.vatStatus ?? '', vatNumber: c.independent?.vatNumber ?? '', legalName: c.independent?.legalName ?? '', seatAddress: c.independent?.seatAddress ?? '',
    nationalityGroup: c.nationalityGroup ?? ''
  };
}

// Un PDF protégé par le jeton ne peut pas être un simple lien : on le télécharge puis on l'ouvre.
export async function ouvrirPdf(url, token, messageErreur) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(messageErreur);
    const blob = await res.blob(); await ouvrirPdfBlob(blob);
  } catch (e) { alert(e.message); }
}
