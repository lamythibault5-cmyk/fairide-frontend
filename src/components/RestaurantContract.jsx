import { useEffect, useState } from 'react';
import { api, API_BASE } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';

// « Mon contrat avec Fairide » dans Mon compte (restaurateur) : le contrat de partenariat, groupé en quatre
// blocs (cadre, engagements de Fairide, engagements du commerce, argent), le PDF, et l'acceptation en ligne
// (nom tapé, horodatée, empreinte). Le texte vient du serveur (restaurantContract.js) : une seule version,
// en français, qui fait foi et qui reprend les chiffres réellement appliqués par la plateforme.
async function ouvrirPdf(url, token, messageErreur) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(messageErreur);
    const blob = await res.blob(); window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  } catch (e) { alert(e.message); }
}

const GROUPES = ['fairide', 'commerce', 'argent', 'cadre'];

export default function RestaurantContract({ restoId }) {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [ouverts, setOuverts] = useState(() => new Set(['fairide', 'commerce']));
  const [nom, setNom] = useState('');
  const [lu, setLu] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/restaurants/${restoId}/contract`, { token }).then((r) => { setD(r); setNom(r.responsibleName || user?.name || ''); }).catch((e) => setErreur(e.message)); }, [restoId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accepter() {
    if (!lu) { toast(t('restoContract.errRead')); return; }
    if (!nom.trim()) { toast(t('restoContract.errName')); return; }
    setBusy(true);
    try { const r = await api(`/restaurants/${restoId}/contract/accept`, { method: 'POST', token, body: { typedName: nom.trim() } }); setD(r); toast(t('restoContract.accepted')); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  const basculer = (g) => setOuverts((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  if (erreur) return <p className="small">{erreur}</p>;
  if (!d) return <p className="small">{t('accountUi.loading')}</p>;
  if (!Array.isArray(d.clauses) || !d.summary) return <p className="small">{t('restoContract.pdfFailed')}</p>;

  return (
    <div className="resto-contract">
      <p className="small" style={{ margin: '0 0 10px' }}>{t('restoContract.intro', { version: d.version })}</p>

      {/* Les chiffres qui comptent, en un coup d'œil */}
      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card"><div className="num">{d.summary.commissionPct} %</div><div className="label">{t('restoContract.kCommission')}</div></div>
        <div className="stat-card"><div className="num">{d.summary.subscription} €</div><div className="label">{t('restoContract.kSubscription')}</div></div>
        <div className="stat-card highlight"><div className="num">{t('restoContract.kMonday')}</div><div className="label">{t('restoContract.kPayout')}</div></div>
        <div className="stat-card"><div className="num">0 %</div><div className="label">{t('restoContract.kDelivery')}</div></div>
      </div>

      {d.acceptedAt ? (
        <div className="paiement-encart" style={{ marginBottom: 12 }}>
          <b>✅ {t('restoContract.acceptedOn', { date: new Date(d.acceptedAt).toLocaleDateString(getLocale()), name: d.acceptedName })}</b>
          <p className="small" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{t('restoContract.version', { version: d.acceptedVersion || d.version })}{d.hash ? ` · ${t('restoContract.hash')} ${d.hash.slice(0, 16)}…` : ''}</p>
          <button type="button" className="btn-outline" style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}/restaurants/${restoId}/contract/pdf`, token, t('restoContract.pdfFailed'))}>📄 {t('restoContract.openPdf')}</button>
        </div>
      ) : (
        <div className="paiement-encart" style={{ marginBottom: 12 }}>
          <b>✍️ {t('restoContract.toAccept')}</b>
          <p className="small" style={{ margin: '4px 0 8px' }}>{t('restoContract.toAcceptHelp')}</p>
          <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => ouvrirPdf(`${API_BASE}/restaurants/${restoId}/contract/pdf`, token, t('restoContract.pdfFailed'))}>📄 {t('restoContract.readPdf')}</button>
        </div>
      )}

      {GROUPES.map((g) => (
        <div key={g} className="resto-contract-groupe">
          <button type="button" className="resto-contract-tete" onClick={() => basculer(g)} aria-expanded={ouverts.has(g)}>
            <span>{t(`restoContract.group_${g}`)}</span>
            <span aria-hidden="true" style={{ transform: ouverts.has(g) ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
          </button>
          {ouverts.has(g) && (
            <ol className="resto-contract-clauses">
              {d.clauses.filter((c) => c.partie === g).map((c) => (
                <li key={c.titre}><b>{c.titre}.</b> {c.corps}</li>
              ))}
            </ol>
          )}
        </div>
      ))}

      {!d.acceptedAt && (
        <div className="paiement-encart" style={{ marginTop: 12 }}>
          <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} style={{ marginTop: 3 }} />
            <span className="small">{t('restoContract.readCheck')}</span>
          </label>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 200px', margin: 0 }}>
              <label htmlFor="resto-contract-nom">{t('restoContract.typedName')}</label>
              <input id="resto-contract-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('restoContract.typedNamePh')} />
            </div>
            <button type="button" className="btn-gold" disabled={busy} style={{ alignSelf: 'flex-end' }} onClick={accepter}>{busy ? '…' : t('restoContract.acceptBtn')}</button>
          </div>
        </div>
      )}
      <p className="small" style={{ margin: '10px 0 0', opacity: 0.8 }}>{t('restoContract.foot')}</p>
    </div>
  );
}
