import { useEffect, useId, useState } from 'react';
import { api, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';

/* « Ma carte et mes engagements » — ce que le commerce signe lui-même (backlog de conformité du
 * 23/09/2026). L'équipe Fairide ne peut rien signer à sa place : en « agir pour », le serveur refuse
 * (SIGNATURE_COMMERCE_SEULEMENT) et le panneau le dit.
 *
 *   A2 — signer la carte (prix, TVA, allergènes, alcool) : sans signature, aucune commande n'est
 *        possible. Toute modification d'un prix, d'une TVA, d'un allergène remet la carte à signer.
 *   A1 — attester la procédure allergènes et donner le numéro que les clients appellent.
 *   A8 — déclarer vendre en tant que professionnel.
 *   A4 — rappeler que les plats alcoolisés restent masqués sans autorisation accises vérifiée. */
// `rafraichir` : la fiche du commerce, rechargée après chaque modification de plat — un prix changé
// remet la carte à signer, le panneau doit le montrer sans recharger la page.
export default function ConformiteCarte({ restoId, rafraichir, onChange }) {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const id = useId();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nom, setNom] = useState('');
  const [coches, setCoches] = useState({});
  const [tel, setTel] = useState('');
  const [referent, setReferent] = useState('');

  const charger = () => api(`/restaurants/${restoId}/compliance`, { token }).then((r) => {
    setD(r);
    setTel((x) => x || r.allergens.contactPhone || r.allergens.fallbackPhone || '');
    setReferent((x) => x || r.allergens.referentName || '');
  }).catch(() => {});
  useEffect(() => { if (restoId) charger(); }, [restoId, rafraichir]); // eslint-disable-line react-hooks/exhaustive-deps

  async function agir(fn, ok) {
    setBusy(true);
    try { await fn(); toast(ok); await charger(); onChange?.(); } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  if (!d) return null;
  const date = (ms) => new Date(ms).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const m = d.menu;
  const toutSigne = m.signed && d.allergens.attestation.attestedAt && d.professional.declaredAt;

  return (
    <details className="card conformite-carte" open={!toutSigne}>
      <summary>
        <b>{t('conformite.menuPanelTitle')}</b>{' '}
        {toutSigne ? <span className="pill teal">✓ {t('conformite.menuPanelDone')}</span> : <span className="pill" style={{ color: 'var(--red)' }}>{t('conformite.menuPanelTodo')}</span>}
      </summary>

      {/* A2 — signature de la carte */}
      <section style={{ marginTop: 12 }}>
        <h4 style={{ margin: '0 0 4px' }}>{t('conformite.menuSignTitle')}</h4>
        {m.signed ? (
          <p className="small" style={{ margin: 0 }}>✓ {t('conformite.menuSigned', { date: m.lastSigned?.signedAt ? date(m.lastSigned.signedAt) : '', name: m.lastSigned?.signedName || '' })}</p>
        ) : (
          <>
            <p className="small" style={{ margin: '0 0 6px' }}>{m.lastSigned ? t('conformite.menuChangedSinceSigned') : t('conformite.menuNeverSigned')}</p>
            {m.missing.length > 0 && (
              <>
                <p className="small" style={{ margin: '0 0 4px', color: 'var(--red)' }}>{t('conformite.menuMissingCount', { n: m.missing.length })}</p>
                <ul className="small" style={{ margin: '0 0 6px 18px' }}>
                  {m.missing.slice(0, 8).map((x) => <li key={`${x.itemId}-${x.code}`}>{x.name} — {t(`conformite.menuMissing_${x.code}`)}</li>)}
                  {m.missing.length > 8 && <li>…</li>}
                </ul>
                {m.vatSuggestions.length > 0 && (
                  <button type="button" className="btn-outline" disabled={busy} style={{ marginBottom: 8 }}
                    onClick={() => agir(async () => {
                      for (const s of m.vatSuggestions) await api(`/restaurants/${restoId}/menu/${s.itemId}`, { method: 'PATCH', token, body: { vatRate: s.suggested } });
                    }, t('conformite.menuVatApplied'))}>
                    {t('conformite.menuApplyVat', { n: m.vatSuggestions.length })}
                  </button>
                )}
                {m.vatSuggestions.length > 0 && <p className="small" style={{ margin: '0 0 8px', color: 'var(--ink-soft)' }}>{t('conformite.menuVatHelp')}</p>}
              </>
            )}
            {m.missing.length === 0 && m.itemCount > 0 && (
              <form onSubmit={(e) => { e.preventDefault(); agir(() => api(`/restaurants/${restoId}/menu/sign`, { method: 'POST', token, body: { typedName: nom.trim(), confirmed: !!coches.carte } }), t('conformite.menuSignedToast')); }}>
                <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={!!coches.carte} onChange={(e) => setCoches((c) => ({ ...c, carte: e.target.checked }))} />
                  <span className="small">{m.text}</span>
                </label>
                <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <input aria-label={t('conformite.typedName')} placeholder={t('conformite.typedName')} value={nom} onChange={(e) => setNom(e.target.value)} style={{ maxWidth: 260 }} />
                  <button type="submit" className="btn-teal" disabled={busy || !coches.carte || nom.trim().length < 3}>{t('conformite.menuSignButton', { n: m.itemCount })}</button>
                </div>
              </form>
            )}
          </>
        )}
        {m.lastSigned && <p className="small" style={{ margin: '6px 0 0' }}><a href={`${API_BASE}/restaurants/${restoId}/menu/versions?download=1`} onClick={async (e) => {
          e.preventDefault();
          try {
            const r = await api(`/restaurants/${restoId}/menu/versions`, { token });
            const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = `cartes-signees-${restoId}.json`; a.click(); URL.revokeObjectURL(url);
          } catch (err) { toast(err.message, 'erreur'); }
        }}>{t('conformite.menuVersionsExport')}</a></p>}
      </section>

      {/* A1 — procédure allergènes */}
      <section style={{ marginTop: 16 }}>
        <h4 style={{ margin: '0 0 4px' }}>{t('conformite.allergenAttestTitle')}</h4>
        {d.allergens.attestation.attestedAt ? (
          <p className="small" style={{ margin: 0 }}>✓ {t('conformite.allergenAttested', { date: date(d.allergens.attestation.attestedAt), name: d.allergens.attestation.attestedName })}</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); agir(() => api(`/restaurants/${restoId}/allergens/attest`, { method: 'POST', token, body: { typedName: nom.trim(), confirmed: !!coches.allergenes, contactPhone: tel.trim(), referentName: referent.trim() } }), t('conformite.allergenAttestedToast')); }}>
            <ul className="small" style={{ margin: '0 0 6px 18px' }}>{(d.allergens.attestation.text || []).map((l) => <li key={l}>{l}</li>)}</ul>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`${id}-tel`} className="small">{t('conformite.allergenPhone')}</label>
                <input id={`${id}-tel`} value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`${id}-ref`} className="small">{t('conformite.allergenReferent')}</label>
                <input id={`${id}-ref`} value={referent} onChange={(e) => setReferent(e.target.value)} />
              </div>
            </div>
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginTop: 6 }}>
              <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={!!coches.allergenes} onChange={(e) => setCoches((c) => ({ ...c, allergenes: e.target.checked }))} />
              <span className="small">{t('conformite.allergenAttestCheck')}</span>
            </label>
            <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <input aria-label={t('conformite.typedName')} placeholder={t('conformite.typedName')} value={nom} onChange={(e) => setNom(e.target.value)} style={{ maxWidth: 260 }} />
              <button type="submit" className="btn-teal" disabled={busy || !coches.allergenes || nom.trim().length < 3 || !tel.trim()}>{t('conformite.allergenAttestButton')}</button>
            </div>
          </form>
        )}
      </section>

      {/* A8 — vendeur professionnel */}
      <section style={{ marginTop: 16 }}>
        <h4 style={{ margin: '0 0 4px' }}>{t('conformite.proTitle')}</h4>
        {d.professional.declaredAt ? (
          <p className="small" style={{ margin: 0 }}>✓ {t('conformite.proDeclared', { date: date(d.professional.declaredAt), name: d.professional.declaredName })}</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); agir(() => api(`/restaurants/${restoId}/professional-declaration`, { method: 'POST', token, body: { typedName: nom.trim(), confirmed: !!coches.pro } }), t('conformite.proDeclaredToast')); }}>
            <ul className="small" style={{ margin: '0 0 6px 18px' }}>{(d.professional.text || []).map((l) => <li key={l}>{l}</li>)}</ul>
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={!!coches.pro} onChange={(e) => setCoches((c) => ({ ...c, pro: e.target.checked }))} />
              <span className="small">{t('conformite.proCheck')}</span>
            </label>
            <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <input aria-label={t('conformite.typedName')} placeholder={t('conformite.typedName')} value={nom} onChange={(e) => setNom(e.target.value)} style={{ maxWidth: 260 }} />
              <button type="submit" className="btn-teal" disabled={busy || !coches.pro || nom.trim().length < 3}>{t('conformite.proButton')}</button>
            </div>
          </form>
        )}
      </section>

      {/* A4 — alcool sans autorisation */}
      {d.alcohol.alcoholItems > 0 && !d.alcohol.authorized && (
        <p className="small" style={{ marginTop: 16, color: 'var(--red)' }}>{t('conformite.alcoholHidden', { n: d.alcohol.alcoholItems })}</p>
      )}
    </details>
  );
}
