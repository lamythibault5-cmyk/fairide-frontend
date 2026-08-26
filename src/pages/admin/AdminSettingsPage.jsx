import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { isTestAccount, TestBadge, fmtDate } from './adminUtils';

const SECTIONS = ['Utilisateurs', 'Avis', 'Codes promo'];

const USER_TYPE_LABELS = { client: 'Clients', restaurant: 'Commerçants', driver: 'Livreurs' };
const USER_TYPE_ORDER = ['client', 'restaurant', 'driver'];

const PROMO_TYPES = [
  { value: 'client_balance', label: 'Solde client (€)' },
  { value: 'restaurant_trial_months', label: 'Mois d\'essai restaurateur' }
];

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [section, setSection] = useState('Utilisateurs');
  const [usersOverview, setUsersOverview] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [promoCodes, setPromoCodes] = useState(null);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState('client_balance');
  const [newPromoValue, setNewPromoValue] = useState('');
  const [newPromoMaxUses, setNewPromoMaxUses] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);

  useEffect(() => {
    if (section === 'Utilisateurs' && usersOverview === null) api('/admin/users/overview', { token }).then(setUsersOverview).catch((e) => toast(e.message));
    if (section === 'Avis' && reviews === null) api('/admin/reviews', { token }).then(setReviews).catch((e) => toast(e.message));
    if (section === 'Codes promo' && promoCodes === null) api('/admin/promo-codes', { token }).then(setPromoCodes).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  async function createPromoCode() {
    if (!newPromoCode.trim() || !newPromoValue) { toast('Code et valeur requis.'); return; }
    setCreatingPromo(true);
    try {
      const created = await api('/admin/promo-codes', {
        method: 'POST', token,
        body: { code: newPromoCode.trim(), type: newPromoType, value: Number(newPromoValue), maxUses: newPromoMaxUses ? Number(newPromoMaxUses) : undefined }
      });
      setPromoCodes((prev) => [created, ...(prev || [])]);
      setNewPromoCode(''); setNewPromoValue(''); setNewPromoMaxUses('');
      toast(`Code ${created.code} créé.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setCreatingPromo(false);
    }
  }

  async function togglePromoCode(id, active) {
    try {
      const updated = await api(`/admin/promo-codes/${id}`, { method: 'PATCH', token, body: { active } });
      setPromoCodes((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      toast(e.message);
    }
  }

  async function deleteReview(id) {
    try {
      await api(`/admin/reviews/${id}`, { method: 'DELETE', token });
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast('Avis supprimé.');
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Paramètres</h2>
      <div className="role-pick" style={{ marginBottom: 16 }}>
        {SECTIONS.map((s) => <div key={s} className={`chip${section === s ? ' active' : ''}`} onClick={() => setSection(s)}>{s}</div>)}
      </div>

      {section === 'Utilisateurs' && (
        !usersOverview ? <SkeletonCards count={2} /> : (
          <div>
            <UsersSubsection title="🆕 Nouveaux inscrits" subtitle="Comptes créés au cours des 30 derniers jours." groups={usersOverview.new} emptyText="Aucun nouvel inscrit sur cette période." />
            <div className="divider" />
            <UsersSubsection title="🚪 Comptes partis" subtitle="Comptes supprimés (clients/livreurs) et commerces supprimés (restaurateurs)." groups={usersOverview.departed} departed emptyText="Personne n'est parti pour l'instant." />
          </div>
        )
      )}

      {section === 'Avis' && (
        <div>
          {!reviews && <SkeletonCards count={3} />}
          {reviews && reviews.length === 0 && <div className="empty">Aucun avis pour l'instant.</div>}
          {reviews && reviews.map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{r.clientName} → {r.restaurantName}</b>
                <button className="btn-danger-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteReview(r.id)}>Supprimer</button>
              </div>
              <div className="small">Nourriture : {r.foodRating}/5 {r.foodComment && `— ${r.foodComment}`}</div>
              {r.deliveryRating && <div className="small">Livraison : {r.deliveryRating}/5 {r.deliveryComment && `— ${r.deliveryComment}`}</div>}
            </div>
          ))}
        </div>
      )}

      {section === 'Codes promo' && (
        <div>
          <div className="card">
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Créer un code promo</h3>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Code</label>
                <input value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} placeholder="Ex: RESTO2MOIS" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Type</label>
                <select value={newPromoType} onChange={(e) => setNewPromoType(e.target.value)}>
                  {PROMO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Valeur ({newPromoType === 'client_balance' ? '€' : 'mois'})</label>
                <input type="number" step="1" value={newPromoValue} onChange={(e) => setNewPromoValue(e.target.value)} placeholder={newPromoType === 'client_balance' ? '20' : '2'} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Utilisations max (optionnel)</label>
                <input type="number" step="1" value={newPromoMaxUses} onChange={(e) => setNewPromoMaxUses(e.target.value)} placeholder="Illimité si vide" />
              </div>
            </div>
            <button className="btn-teal" disabled={creatingPromo} onClick={createPromoCode}>{creatingPromo ? '...' : 'Créer le code'}</button>
          </div>

          {!promoCodes && <SkeletonCards count={3} />}
          {promoCodes && promoCodes.length === 0 && <div className="empty">Aucun code promo.</div>}
          {promoCodes && promoCodes.map((p) => (
            <div className="card" key={p.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <b style={{ fontFamily: 'monospace', fontSize: 15 }}>{p.code}</b>{' '}
                  <span className="pill teal" style={{ marginLeft: 6 }}>
                    {p.type === 'client_balance' ? `${p.value}€ client` : `${p.value} mois offert(s) restaurateur`}
                  </span>
                  {!p.active && <span className="pill" style={{ marginLeft: 6, color: 'var(--red)' }}>Désactivé</span>}
                </div>
                <button className={p.active ? 'btn-danger-ghost' : 'btn-outline'} style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => togglePromoCode(p.id, !p.active)}>
                  {p.active ? 'Désactiver' : 'Activer'}
                </button>
              </div>
              <div className="small" style={{ marginTop: 4 }}>{p.usesCount} utilisation(s){p.maxUses ? ` / ${p.maxUses} max` : ' (illimité)'}</div>
            </div>
          ))}
        </div>
      )}
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

function statusPill(status) {
  if (status === 'approved') return <span className="pill teal">✅ Validé</span>;
  if (status === 'blocked') return <span className="pill" style={{ color: 'var(--red)' }}>🚫 Bloqué</span>;
  return <span className="pill">🕐 En attente</span>;
}

function UserTypeGroup({ type, items, departed }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => [it.name, it.email, it.restaurantName, it.reason, it.comment].some((v) => v && v.toLowerCase().includes(q)))
    : items;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>
          {USER_TYPE_LABELS[type]} <span className="pill" style={{ marginLeft: 6 }}>{items.length}</span>
        </h4>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Chercher un(e) ${USER_TYPE_LABELS[type].toLowerCase()}...`} style={{ maxWidth: 260, flex: '1 1 200px' }} />
      </div>
      {filtered.length === 0 && <div className="empty">Aucun résultat pour "{search}".</div>}
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
                      {type === 'driver' && statusPill(it.adminStatus)}
                      {type === 'restaurant' && (
                        it.restaurantName ? <>🏪 {it.restaurantName} {statusPill(it.restaurantAdminStatus)}</> : <span className="small" style={{ opacity: 0.6 }}>Pas encore de restaurant créé</span>
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
