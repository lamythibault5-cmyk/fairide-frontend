import { DrawerRow } from './RecordDrawer';
import { fmtDate } from '../../pages/admin/adminUtils';
import { libelleManque } from '../../conformite';

// Fiche livreur complète, en tête du panneau Admin › Livreurs (fondateur, 2026-09-30 : « voir la fiche livreur au
// complet, avec son moyen de transport, s'il a besoin d'un sac Fairide ou a déjà le sien, le statut qu'il a choisi »).
// Lit le dossier coursier (GET /admin/couriers/:id) ; les décisions (vérifier, approuver, sac remis…) restent dans le
// dossier complet, que le bouton ouvre sur place. Règle de la console : aucune donnée privée ici — ni date de
// naissance, ni numéro national, ni numéro de permis ; on dit seulement si c'est renseigné.
export default function FicheLivreur({ dossier, tr, onOpen }) {
  const c = dossier.courier;
  const statut = (s) => (s ? tr(`courierOnboarding.status_${s}`) : tr('adminDrivers.statusNotChosen'));
  const motorise = ['scooter', 'voiture'].includes(c.vehicleType);
  const docs = dossier.documents || [];
  const contrat = (dossier.contracts || [])[0];
  const manques = dossier.missing || [];
  const sac = c.bag?.option
    ? `${tr(`auth.bag_${c.bag.option}`)}${c.bag.option === 'fairide' ? ` · ${tr(`adminCouriers.bagDeposit_${c.bag.depositStatus}`)} (${Number(c.bag.depositAmount || 40).toFixed(0)} €)` : ''}`
    : tr('adminDrivers.notAnswered');

  return (
    <div className="fiche-livreur">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h4 className="drawer-section-title" style={{ margin: 0 }}>{tr('adminDrivers.ficheTitle')}</h4>
        <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onOpen}>{tr('adminDrivers.openFullFile')}</button>
      </div>
      <DrawerRow label={tr('adminDrivers.rowFile')} value={tr(`courierOnboarding.lifecycle_${c.lifecycleStatus}`)} strong />
      <DrawerRow
        label={tr('adminDrivers.rowStatus')}
        value={`${statut(c.statusType)} · ${c.statusVerifiedAt ? tr('adminDrivers.statusVerified', { date: fmtDate(c.statusVerifiedAt) }) : tr('adminDrivers.statusToVerify')}`}
        strong
      />
      {dossier.requestedStatusType && (
        <DrawerRow label={tr('adminDrivers.rowStatusRequest')} value={`${statut(dossier.requestedStatusType)}${dossier.requestedStatusReason ? ` — ${dossier.requestedStatusReason}` : ''}`} />
      )}
      <DrawerRow label={tr('adminDrivers.rowVehicle')} value={c.vehicleType ? tr(`courierOnboarding.vehicle_${c.vehicleType}`) : tr('adminDrivers.notAnswered')} strong />
      {motorise && (
        <DrawerRow label={tr('adminDrivers.rowLicence')} value={c.licenceNumber || c.licencePlate ? tr('adminDrivers.licenceGiven', { plate: c.licencePlate || '—' }) : tr('adminDrivers.notAnswered')} />
      )}
      <DrawerRow label={tr('adminDrivers.rowBag')} value={sac} strong />
      <DrawerRow label={tr('adminDrivers.rowZone')} value={c.zone || tr('adminDrivers.notAnswered')} />
      <DrawerRow label={tr('adminDrivers.rowMinFee')} value={c.minFeeCents ? `${(c.minFeeCents / 100).toFixed(2).replace('.', ',')} €` : tr('adminDrivers.minFeeNone')} />
      <DrawerRow label={tr('adminDrivers.rowIdentity')} value={c.identity?.status === 'verified' ? tr('adminDrivers.identityVerified', { date: fmtDate(c.identity.verifiedAt) }) : tr('adminDrivers.identityNotVerified')} />
      {c.nationalityGroup && <DrawerRow label={tr('adminDrivers.rowNationality')} value={tr(`conformite.nationality_${c.nationalityGroup}`)} />}
      {c.statusType === 'student_independent' && c.student?.school && (
        <DrawerRow label={tr('adminDrivers.rowSchool')} value={`${c.student.school}${c.student.academicYear ? ` · ${c.student.academicYear}` : ''}`} />
      )}
      {c.independent?.companyNumber && (
        <DrawerRow label={tr('adminDrivers.rowCompany')} value={`${c.independent.legalName || ''} ${c.independent.companyNumber}${c.independent.companyVerified ? ' ✓' : ''}`.trim()} />
      )}
      <DrawerRow label={tr('adminDrivers.rowContract')} value={contrat ? tr('adminDrivers.contractSigned', { date: fmtDate(contrat.signedAt), version: contrat.version }) : tr('adminDrivers.contractNone')} />
      <DrawerRow label={tr('adminDrivers.rowDocs')} value={tr('adminDrivers.docsCount', { n: docs.length, v: docs.filter((d) => d.verifiedAt).length })} />
      <DrawerRow label={tr('adminDrivers.rowPayout')} value={`${c.hasIban || c.payoutIbanKnown ? tr('adminDrivers.ibanGiven') : tr('adminDrivers.ibanNotGiven')} · Stripe ${dossier.user?.stripeConnectStatus || '-'}`} />
      <div className="drawer-row" style={{ alignItems: 'flex-start' }}>
        <span className="small">{tr('adminDrivers.rowMissing')}</span>
        <span className="small" style={{ textAlign: 'right', color: manques.length ? 'var(--orange)' : 'var(--teal-deep)', fontWeight: 600 }}>
          {manques.length ? manques.map((m) => libelleManque(m, tr)).join(', ') : tr('adminDrivers.nothingMissing')}
        </span>
      </div>
      <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink-faint)' }}>{tr('adminDrivers.fileSince', { date: fmtDate(c.createdAt) })}</p>
    </div>
  );
}
