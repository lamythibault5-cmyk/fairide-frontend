import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

const TYPES = [
  { value: 'percent', label: 'typePercent' },
  { value: 'bogo', label: 'typeBuyN' },
  { value: 'cart_threshold', label: 'typeCart' }
];

export default function PromotionsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, restoId } = useOutletContext();

  const [promos, setPromos] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState('percent');
  const [itemId, setItemId] = useState('');
  const [percentValue, setPercentValue] = useState('15');
  const [bogoN, setBogoN] = useState('1');
  const [discountValue, setDiscountValue] = useState('');
  const [minCartTotal, setMinCartTotal] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  function loadPromos() {
    api(`/restaurants/${restoId}/promotions/mine`, { token }).then(setPromos).catch((e) => toast(e.message));
  }

  useEffect(() => {
    loadPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  async function createPromo() {
    setSaving(true);
    try {
      if (type === 'cart_threshold') {
        const x = Number(discountValue);
        const y = Number(minCartTotal);
        if (!x || x <= 0) { toast(t('promosPage.toastAmount')); setSaving(false); return; }
        if (!y || y <= x) { toast(t('promosPage.toastThreshold')); setSaving(false); return; }
        await api(`/restaurants/${restoId}/promotions`, { method: 'POST', token, body: { discountValue: x, minCartTotal: y } });
      } else {
        if (!itemId) { toast(t('promosPage.toastChooseDish')); setSaving(false); return; }
        const body = type === 'percent' ? { type: 'percent', value: Number(percentValue) } : { type: 'bogo', value: Number(bogoN) };
        await api(`/restaurants/${restoId}/menu/${itemId}/promotions`, { method: 'POST', token, body });
      }
      setFormOpen(false);
      setItemId(''); setDiscountValue(''); setMinCartTotal('');
      loadPromos();
      toast(t('promosPage.toastCreated'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo) {
    setTogglingId(promo.id);
    try {
      await api(`/promotions/${promo.id}`, { method: 'PATCH', token, body: { active: !promo.active } });
      loadPromos();
    } catch (e) {
      toast(e.message);
    } finally {
      setTogglingId(null);
    }
  }

  async function deletePromo(promo) {
    setDeletingId(promo.id);
    try {
      await api(`/promotions/${promo.id}`, { method: 'DELETE', token });
      loadPromos();
      toast(t('promosPage.toastDeleted'));
    } catch (e) {
      toast(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('promosPage.title')}</h2>
      <p className="small" style={{ margin: '0 0 14px' }}>
        {t('promosPage.intro')}
      </p>

      {promos === null && <div className="empty">{t('promosPage.loading')}</div>}
      {promos !== null && promos.length === 0 && !formOpen && <div className="empty">{t('promosPage.none')}</div>}
      {promos !== null && promos.map((p) => (
        <div className="card" key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <span className="pill teal">🏷️ {p.label}</span>
              <div className="small" style={{ marginTop: 6 }}>{p.itemName || t('promosPage.wholeOrder')}{!p.active ? ' — inactive' : ''}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={togglingId === p.id} onClick={() => toggleActive(p)}>
                {togglingId === p.id ? '...' : p.active ? t('promosPage.disable') : t('promosPage.enable')}
              </button>
              <button className="btn-danger-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={deletingId === p.id} onClick={() => deletePromo(p)}>
                {deletingId === p.id ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      ))}

      {!formOpen ? (
        <button type="button" className="btn-teal" onClick={() => setFormOpen(true)}>{t('promosPage.addPromo')}</button>
      ) : (
        <div className="card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{t('promosPage.newPromo')}</h3>
          <div className="field">
            <label>{t('promosPage.type')}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((tp) => <option key={tp.value} value={tp.value}>{t(`promosPage.${tp.label}`)}</option>)}
            </select>
          </div>

          {type !== 'cart_threshold' && (
            <div className="field">
              <label>{t('promosPage.dish')}</label>
              <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">{t('promosPage.chooseDish')}</option>
                {(restaurant.menu || []).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
          )}

          {type === 'percent' && (
            <div className="field">
              <label>{t('promosPage.discount')}</label>
              <select value={percentValue} onChange={(e) => setPercentValue(e.target.value)}>
                {[10, 15, 20, 25, 30, 40, 50].map((v) => <option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
          )}

          {type === 'bogo' && (
            <div className="field">
              <label>{t('promosPage.buyN')}</label>
              <select value={bogoN} onChange={(e) => setBogoN(e.target.value)}>
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} acheté{v > 1 ? 's' : ''} = 1 offert</option>)}
              </select>
            </div>
          )}

          {type === 'cart_threshold' && (
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>{t('promosPage.amountOff')}</label>
                <input type="number" step="0.5" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="5" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t('promosPage.threshold')}</label>
                <input type="number" step="0.5" value={minCartTotal} onChange={(e) => setMinCartTotal(e.target.value)} placeholder="30" />
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 8 }}>
            <button className="btn-teal" disabled={saving} onClick={createPromo}>{saving ? '...' : t('promosPage.createPromo')}</button>
            <button className="btn-ghost" onClick={() => setFormOpen(false)}>{t('promosPage.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
