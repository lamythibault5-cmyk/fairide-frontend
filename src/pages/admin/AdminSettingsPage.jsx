import { useEffect, useState } from 'react';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { isTestAccount, TestBadge, fmtDate } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const SECTIONS = ['Tarification', 'Utilisateurs'];
const sectionLabels = (tr) => ({ "Tarification": tr('adminSettings.section_pricing'), "Utilisateurs": tr('adminSettings.section_users'), "Avis": tr('adminSettings.section_reviews'), "Codes promo": tr('adminSettings.section_promos') });

const pricingFields = (tr) => [
  { key: 'commissionRate', label: tr('adminSettings.commissionLabel'), suffix: '%', isRate: true, hint: tr('adminSettings.commissionHint') },
  { key: 'deliveryFairideRate', label: tr('adminSettings.deliveryShareLabel'), suffix: '%', isRate: true, hint: tr('adminSettings.deliveryShareHint') },
  { key: 'deliveryBaseFee', label: tr('adminSettings.baseDeliveryRate'), suffix: '€', hint: tr('adminSettings.baseFeeHint') },
  { key: 'deliveryBaseKm', label: tr('adminSettings.baseDistance'), suffix: 'km' },
  { key: 'deliveryExtraPerKm', label: tr('adminSettings.perKmExtra'), suffix: '€/km' },
  { key: 'vatRateCommission', label: tr('adminSettings.vatCommission'), suffix: '%', isRate: true, hint: tr('adminSettings.vatCommissionHint') },
  { key: 'vatRateDeliveryShare', label: tr('adminSettings.vatDeliveryShare'), suffix: '%', isRate: true, hint: tr('adminSettings.vatDeliveryHint') },
  { key: 'vatRateServiceFee', label: tr('adminSettings.vatServiceFees'), suffix: '%', isRate: true, hint: tr('adminSettings.vatServiceHint') }
];
// Clés/suffixes seuls, pour les conversions hors rendu (les libellés y sont inutiles).
const PRICING_FIELD_DEFS = pricingFields(() => '');

const userTypeLabels = (tr) => ({ client: tr('adminSettings.clients'), restaurant: tr('adminSettings.merchants'), driver: tr('adminSettings.drivers') });
const USER_TYPE_ORDER = ['client', 'restaurant', 'driver'];

function toDisplayForm(p) {
  const out = {};
  PRICING_FIELD_DEFS.forEach((f) => { out[f.key] = f.isRate ? +(Number(p[f.key]) * 100).toFixed(2) : Number(p[f.key]); });
  return out;
}

export default function AdminSettingsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [section, setSection] = useState('Tarification');
  const [pricing, setPricing] = useState(null);
  const [pricingForm, setPricingForm] = useState(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [usersOverview, setUsersOverview] = useState(null);
  useEffect(() => {
    if (section === 'Tarification' && pricing === null) {
      api('/admin/settings', { token }).then((p) => { setPricing(p); setPricingForm(toDisplayForm(p)); }).catch((e) => toast(e.message));
    }
    if (section === 'Utilisateurs' && usersOverview === null) api('/admin/users/overview', { token }).then(setUsersOverview).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const pricingDirty = pricing && pricingForm && PRICING_FIELD_DEFS.some((f) => Number(pricingForm[f.key]) !== Number(toDisplayForm(pricing)[f.key]));

  async function savePricing() {
    setSavingPricing(true);
    try {
      const body = {};
      PRICING_FIELD_DEFS.forEach((f) => { body[f.key] = f.isRate ? Number(pricingForm[f.key]) / 100 : Number(pricingForm[f.key]); });
      const updated = await api('/admin/settings', { method: 'PATCH', token, body });
      setPricing(updated);
      setPricingForm(toDisplayForm(updated));
      toast(tr('adminSettings.toastPricingUpdated'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSavingPricing(false);
      setConfirmSave(false);
    }
  }

  return (
    <div>
      <AdminPageHeader module="settings" />
      <div className="role-pick" style={{ marginBottom: 16 }}>
        {SECTIONS.map((s) => <div key={s} className={`chip${section === s ? ' active' : ''}`} onClick={() => setSection(s)}>{sectionLabels(tr)[s] || s}</div>)}
      </div>

      {section === 'Tarification' && (
        !pricingForm ? <SkeletonCards count={1} /> : (
          <div className="card">
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{tr('adminSettings.pricingTitle')}</h3>
            <p className="small" style={{ margin: '0 0 14px', opacity: 0.75 }}>
              {tr('adminSettings.pricingHelp')}
            </p>
            {pricingFields(tr).map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label} ({f.suffix}){f.hint ? <span className="small" style={{ opacity: 0.6 }}> — {f.hint}</span> : null}</label>
                <input
                  type="number" step="0.01"
                  value={pricingForm[f.key]}
                  onChange={(e) => setPricingForm({ ...pricingForm, [f.key]: e.target.value })}
                />
              </div>
            ))}
            <button className="btn-teal" disabled={!pricingDirty || savingPricing} onClick={() => setConfirmSave(true)}>
              {savingPricing ? '...' : 'Enregistrer'}
            </button>
          </div>
        )
      )}

      {section === 'Utilisateurs' && (
        !usersOverview ? <SkeletonCards count={2} /> : (
          <div>
            <UsersSubsection title={tr('adminSettings.newSignups')} subtitle={tr('adminSettings.newSignupsHelp')} groups={usersOverview.new} emptyText={tr('adminSettings.noNewSignups')} />
            <div className="divider" />
            <UsersSubsection title={tr('adminSettings.leftAccounts')} subtitle={tr('adminSettings.leftHelp')} groups={usersOverview.departed} departed emptyText={tr('adminSettings.nobodyLeft')} />
          </div>
        )
      )}

      <p className="small" style={{ margin: '12px 0 0' }}>{tr('adminSettings.movedApps')}</p>
      <ConfirmDialog
        open={confirmSave}
        title={tr('adminSettings.confirmPricing')}
        message={tr('adminSettings.confirmPricingBody')}
        danger
        loading={savingPricing}
        onConfirm={savePricing}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  );
}

function UsersSubsection({ title, subtitle, groups, departed, emptyText }) {
  const totalCount = USER_TYPE_ORDER.reduce((sum, type) => sum + (groups[type]?.length || 0), 0);
  return (
    <div style={{ marginBottom: 10 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{title} <span className="pill teal" style={{ marginLeft: 6 }}>{totalCount}</span></h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{subtitle}</p>
      {totalCount === 0 && <div className="empty">{emptyText}</div>}
      {USER_TYPE_ORDER.map((type) => {
        const items = groups[type] || [];
        if (!items.length) return null;
        return <UserTypeGroup key={type} type={type} items={items} departed={departed} />;
      })}
    </div>
  );
}

function statusPill(status, tr) {
  if (status === 'approved') return <span className="pill teal">{tr('adminSettings.validated')}</span>;
  if (status === 'blocked') return <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminSettings.blocked')}</span>;
  return <span className="pill">{tr('adminSettings.pendingBadge')}</span>;
}

function UserTypeGroup({ type, items, departed }) {
  const { t: tr } = useLanguage();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => [it.name, it.email, it.restaurantName, it.reason, it.comment].some((v) => v && v.toLowerCase().includes(q)))
    : items;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>
          {userTypeLabels(tr)[type]} <span className="pill" style={{ marginLeft: 6 }}>{items.length}</span>
        </h4>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('adminSettings.phSearchType', { type: userTypeLabels(tr)[type].toLowerCase() })} style={{ maxWidth: 260, flex: '1 1 200px' }} />
      </div>
      {filtered.length === 0 && <div className="empty">{tr('adminSettings.noResultsFor', { q: search })}</div>}
      {filtered.length > 0 && (
        <div className="card">
          {filtered.map((it, i) => (
            <div key={it.id} className={`row${isTestAccount(it.email) ? ' row-test-account' : ''}`} style={{ justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < filtered.length - 1 ? '1px solid var(--cream-dim)' : 'none', flexWrap: 'wrap' }}>
              <div>
                <span className="small" style={{ fontWeight: 700, marginRight: 8 }}>#{i + 1}</span>
                {departed ? (
                  <>
                    <b>{it.email}</b>
                    {isTestAccount(it.email) && <TestBadge />}
                    {it.restaurantName && <span className="small"> — {it.restaurantName}</span>}
                    {it.reason && <div className="small" style={{ opacity: 0.7 }}>{it.reason}{it.comment ? ` — ${it.comment}` : ''}</div>}
                  </>
                ) : (
                  <>
                    <b>{it.name}</b> <span className="small">{it.email}</span>
                    {isTestAccount(it.email) && <TestBadge />}
                    {it.phone && <div className="small">📞 {it.phone}</div>}
                    <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {type === 'driver' && statusPill(it.adminStatus, tr)}
                      {type === 'restaurant' && (
                        it.restaurantName ? <>🏪 {it.restaurantName} {statusPill(it.restaurantAdminStatus, tr)}</> : <span className="small" style={{ opacity: 0.6 }}>{tr('adminSettings.noRestaurantYet')}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
              <span className="small" style={{ flexShrink: 0 }}>{fmtDate(it.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
