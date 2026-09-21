import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

// Demandes de suppression de compte des livreurs et restaurateurs (fondateur, 2026-09-19) : leur code de
// confirmation n'arrive pas dans leur boîte mais ici, dans le tableau de bord, en plus de l'e-mail à l'équipe.
// L'admin contacte la personne, lui transmet le code, puis marque la demande traitée. Les clients, eux,
// reçoivent leur code directement par e-mail et n'apparaissent pas ici.
export default function DeletionRequestsPanel({ onHandled }) {
  const { token } = useAuth();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  async function charger() {
    try { setRows(await api('/admin/deletion-requests', { token })); } catch { setRows([]); }
  }
  useEffect(() => { charger(); }, []);

  async function traiter(id, outcome) {
    setBusy(id);
    try {
      await api(`/admin/deletion-requests/${id}`, { method: 'PATCH', token, body: { outcome } });
      toast(t(outcome === 'transmis' ? 'adminHome.deletionMarkedSent' : 'adminHome.deletionMarkedDropped'));
      await charger(); onHandled?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(null); }
  }

  const enAttente = (rows || []).filter((r) => r.pending);
  const traitees = (rows || []).filter((r) => !r.pending);
  if (!rows || (!enAttente.length && !traitees.length)) return null;
  const fmt = (d) => new Date(d).toLocaleString(locale || 'fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const role = (r) => t(r === 'driver' ? 'adminHome.deletionRoleDriver' : r === 'restaurant' ? 'adminHome.deletionRoleRestaurant' : 'adminHome.deletionRoleOther');
  return (
    <section className="card" id="suppressions" style={{ marginTop: 12 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🗑️ {t('adminHome.deletionsTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('adminHome.deletionsIntro')}</p>
      {enAttente.length === 0 && <p className="small">{t('adminHome.deletionsNone')}</p>}
      {enAttente.map((r) => (
        <div key={r.id} className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--cream-dim)' }}>
          <div style={{ flex: '1 1 220px' }}>
            <b>{r.name || r.email}</b> <span className="small">· {role(r.role)}{r.restaurantName ? ` · ${r.restaurantName}` : ''}</span>
            <div className="small"><a href={`mailto:${r.email}`}>{r.email}</a> · {t('adminHome.deletionAskedAt', { date: fmt(r.createdAt) })} · {t('adminHome.deletionExpiresAt', { date: fmt(r.expiresAt) })}</div>
          </div>
          <code style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, padding: '4px 10px', background: 'var(--cream-dim)', borderRadius: 8 }}>{r.code}</code>
          <button type="button" className="btn-teal" disabled={busy === r.id} onClick={() => traiter(r.id, 'transmis')}>{t('adminHome.deletionMarkSent')}</button>
          <button type="button" className="btn-ghost" disabled={busy === r.id} onClick={() => traiter(r.id, 'abandonne')}>{t('adminHome.deletionMarkDropped')}</button>
        </div>
      ))}
      {traitees.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="small">{t('adminHome.deletionsHandled', { n: traitees.length })}</summary>
          <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {traitees.map((r) => <li key={r.id}>{r.name || r.email} · {role(r.role)} · {t(`adminHome.deletionOutcome_${r.outcome || 'expire'}`)} · {fmt(r.handledAt || r.expiresAt)}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
