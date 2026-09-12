import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useDebouncedValue } from '../adminUtils';
import { COMMUNES, ROLES, LANGS, audienceVide, audienceVersForm, audienceVersApi, personnaliser, paragraphes } from './marketingUtils';

// Formulaire de campagne : modèles, constructeur d'audience (avec compteur de destinataires en direct),
// contenu de l'e-mail et aperçu approximatif du rendu. Sert à la création (POST) comme à la
// modification d'un brouillon ou d'une campagne programmée (PATCH).
function depuis(c) {
  return {
    name: c?.name || '', subject: c?.subject || '', body: c?.body || '', ctaLabel: c?.ctaLabel || '', ctaUrl: c?.ctaUrl || '',
    audience: c ? audienceVersForm(c.audience) : { ...audienceVide(), roles: ['client'] }
  };
}

export default function CampaignForm({ initial, templates, onSaved, onCancel }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => depuis(initial));
  const [modele, setModele] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apercu, setApercu] = useState({ loading: false, count: null, sample: [], error: null });

  useEffect(() => { setForm(depuis(initial)); setModele(null); }, [initial]);

  const audienceApi = useMemo(() => audienceVersApi(form.audience), [form.audience]);
  const audienceKey = useDebouncedValue(JSON.stringify(audienceApi), 400);

  useEffect(() => {
    const a = JSON.parse(audienceKey);
    if (!a.roles.length) { setApercu({ loading: false, count: null, sample: [], error: null }); return undefined; }
    let actif = true;
    setApercu((p) => ({ ...p, loading: true, error: null }));
    api('/admin/marketing/audience/preview', { method: 'POST', token, body: { audience: a } })
      .then((r) => { if (actif) setApercu({ loading: false, count: r.count, sample: r.sample || [], error: null }); })
      .catch((e) => { if (actif) setApercu({ loading: false, count: null, sample: [], error: e.message }); });
    return () => { actif = false; };
  }, [audienceKey, token]);

  const setAud = (patch) => setForm((f) => ({ ...f, audience: { ...f.audience, ...patch } }));
  const toggleRole = (r) => setAud({ roles: form.audience.roles.includes(r) ? form.audience.roles.filter((x) => x !== r) : [...form.audience.roles, r] });
  const toggleCommune = (c) => setAud({ communes: form.audience.communes.includes(c) ? form.audience.communes.filter((x) => x !== c) : [...form.audience.communes, c] });

  function appliquerModele(m) {
    setForm((f) => ({ name: f.name || m.name, subject: m.subject, body: m.body, ctaLabel: m.ctaLabel || '', ctaUrl: m.ctaUrl || '', audience: audienceVersForm(m.audience) }));
    setModele(m.key);
    toast(tr('adminMarketing.templateApplied'));
  }

  function valider() {
    if (!form.name.trim()) return tr('adminMarketing.errName');
    if (!form.audience.roles.length) return tr('adminMarketing.errRoles');
    if (!form.subject.trim()) return tr('adminMarketing.errSubject');
    if (!form.body.trim()) return tr('adminMarketing.errBody');
    if (!!form.ctaLabel.trim() !== !!form.ctaUrl.trim()) return tr('adminMarketing.errCta');
    return null;
  }

  async function enregistrer() {
    const err = valider();
    if (err) { toast(err); return; }
    setSaving(true);
    try {
      const body = { name: form.name.trim(), subject: form.subject.trim(), body: form.body.trim(), ctaLabel: form.ctaLabel.trim(), ctaUrl: form.ctaUrl.trim(), audience: audienceApi };
      const r = initial?.id
        ? await api(`/admin/marketing/campaigns/${initial.id}`, { method: 'PATCH', token, body })
        : await api('/admin/marketing/campaigns', { method: 'POST', token, body });
      onSaved(r, !!initial?.id);
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }

  const sujetApercu = personnaliser(form.subject);
  const parasApercu = paragraphes(personnaliser(form.body));
  const compteur = apercu.count === null ? null : apercu.count === 0 ? tr('adminMarketing.recipientsNone') : apercu.count === 1 ? tr('adminMarketing.recipientsOne') : tr('adminMarketing.recipients', { n: apercu.count });

  return (
    <div className="mk-form-layout">
      <div>
        {initial?.id && (
          <div className="card mk-editing"><b>{tr('adminMarketing.editingBanner', { name: initial.name })}</b><button type="button" className="btn-ghost" onClick={onCancel}>{tr('adminCommon.cancel')}</button></div>
        )}

        {!initial?.id && templates && templates.length > 0 && (
          <div className="card">
            <h3 className="mk-section-title">{tr('adminMarketing.templates')}</h3>
            <div className="mk-templates">
              {templates.map((m) => (
                <button key={m.key} type="button" className={`mk-chip${modele === m.key ? ' active' : ''}`} onClick={() => appliquerModele(m)}>{m.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="field">
            <label htmlFor="mk-name">{tr('adminMarketing.fName')}</label>
            <input id="mk-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tr('adminMarketing.phName')} maxLength={120} />
          </div>
        </div>

        <div className="card">
          <h3 className="mk-section-title">{tr('adminMarketing.audienceTitle')}</h3>
          <div className="field">
            <label>{tr('adminMarketing.roles')}</label>
            <div className="role-pick" style={{ margin: 0 }}>
              {ROLES.map((r) => (
                <div key={r} role="button" tabIndex={0} className={`chip${form.audience.roles.includes(r) ? ' active' : ''}`} onClick={() => toggleRole(r)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRole(r); } }}>
                  {tr(`adminMarketing.role_${r}`)}
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <div className="field-label-row">
              <label>{tr('adminMarketing.communes')} {form.audience.communes.length > 0 && <span className="pill">{form.audience.communes.length}</span>}</label>
              <span className="row" style={{ gap: 6 }}>
                <button type="button" className="field-toggle btn-ghost" onClick={() => setAud({ communes: [...COMMUNES] })}>{tr('adminMarketing.allCommunes')}</button>
                <button type="button" className="field-toggle btn-ghost" onClick={() => setAud({ communes: [] })}>{tr('adminMarketing.clearCommunes')}</button>
              </span>
            </div>
            <div className="mk-communes">
              {COMMUNES.map((c) => (
                <button key={c} type="button" className={`mk-chip${form.audience.communes.includes(c) ? ' active' : ''}`} onClick={() => toggleCommune(c)}>{c}</button>
              ))}
            </div>
            <p className="small mk-muted" style={{ margin: '6px 0 0' }}>{form.audience.communes.length === 0 ? tr('adminMarketing.communesHintAll') : tr('adminMarketing.communesHintSome')}</p>
          </div>
          <div className="mk-grid-2">
            <div className="field">
              <label htmlFor="mk-lang">{tr('adminCommon.language')}</label>
              <select id="mk-lang" value={form.audience.lang} onChange={(e) => setAud({ lang: e.target.value })}>
                <option value="">{tr('adminMarketing.anyLang')}</option>
                {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mk-active">{tr('adminMarketing.activeWithin')}</label>
              <input id="mk-active" type="number" min="1" step="1" value={form.audience.activeWithinDays} onChange={(e) => setAud({ activeWithinDays: e.target.value })} placeholder={tr('adminMarketing.phDays')} />
            </div>
            <div className="field">
              <label htmlFor="mk-inactive">{tr('adminMarketing.inactiveFor')}</label>
              <input id="mk-inactive" type="number" min="1" step="1" value={form.audience.inactiveForDays} onChange={(e) => setAud({ inactiveForDays: e.target.value })} placeholder={tr('adminMarketing.phDays')} />
            </div>
            <div className="field">
              <label htmlFor="mk-min">{tr('adminMarketing.minOrders')}</label>
              <input id="mk-min" type="number" min="1" step="1" value={form.audience.minOrders} onChange={(e) => setAud({ minOrders: e.target.value })} placeholder={tr('adminMarketing.phMin')} />
            </div>
          </div>
          <label className="mk-check">
            <input type="checkbox" checked={form.audience.verifiedOnly} onChange={(e) => setAud({ verifiedOnly: e.target.checked })} />
            <span>{tr('adminMarketing.verifiedOnly')}</span>
          </label>
          <p className="small mk-muted" style={{ margin: '4px 0 0' }}>{tr('adminMarketing.activityHint')}</p>

          <div className="mk-audience-box" aria-live="polite">
            {!form.audience.roles.length && <p className="small" style={{ margin: 0 }}>{tr('adminMarketing.recipientsHint')}</p>}
            {form.audience.roles.length > 0 && (
              <>
                <div className="mk-audience-count">{apercu.loading && apercu.count === null ? tr('adminMarketing.computing') : (compteur ?? '…')}{apercu.loading && apercu.count !== null && <span className="small mk-muted"> · {tr('adminMarketing.computing')}</span>}</div>
                {apercu.error && <p className="small" style={{ color: 'var(--red)', margin: '4px 0 0' }}>{apercu.error}</p>}
                {apercu.sample.length > 0 && (
                  <>
                    <p className="small mk-muted" style={{ margin: '6px 0 0' }}>{tr('adminMarketing.sampleTitle', { n: apercu.sample.length })}</p>
                    <ul className="mk-sample">
                      {apercu.sample.map((s, i) => (
                        <li key={`${s.email}-${i}`}>
                          <span><b>{s.name || '-'}</b> <span className="mk-muted">{s.email}</span></span>
                          <span className="mk-muted">{tr(`adminMarketing.role_${s.role}`)}{s.commune ? ` · ${s.commune}` : ''}{s.lang ? ` · ${String(s.lang).toUpperCase()}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="mk-section-title">{tr('adminMarketing.contentTitle')}</h3>
          <div className="field">
            <label htmlFor="mk-subject">{tr('adminCommon.subject')}</label>
            <input id="mk-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={tr('adminMarketing.phSubject')} maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="mk-body">{tr('adminMarketing.body')}</label>
            <textarea id="mk-body" className="mk-textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={tr('adminMarketing.phBody')} maxLength={20000} />
            <p className="small mk-muted" style={{ margin: '6px 0 0' }}>{tr('adminMarketing.placeholders')}</p>
          </div>
          <div className="mk-grid-2">
            <div className="field">
              <label htmlFor="mk-cta">{tr('adminMarketing.ctaLabel')}</label>
              <input id="mk-cta" value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} placeholder={tr('adminMarketing.phCtaLabel')} maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="mk-cta-url">{tr('adminMarketing.ctaUrl')}</label>
              <input id="mk-cta-url" type="url" value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} placeholder={tr('adminMarketing.phCtaUrl')} maxLength={500} />
            </div>
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {onCancel && <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>{tr('adminCommon.cancel')}</button>}
            <button type="button" className="btn-gold" onClick={enregistrer} disabled={saving}>{saving ? tr('adminMarketing.saving') : (initial?.id ? tr('adminCommon.save') : tr('adminMarketing.saveDraft'))}</button>
          </div>
          <p className="small mk-muted" style={{ margin: '8px 0 0', textAlign: 'right' }}>{tr('adminMarketing.saveHint')}</p>
        </div>
      </div>

      <aside className="mk-sticky">
        <div className="card">
          <h3 className="mk-section-title">{tr('adminMarketing.previewTitle')}</h3>
          <div className="mk-email">
            <div className="mk-email-subject">
              <span className="small mk-muted">{tr('adminCommon.subject')}</span>
              <b>{sujetApercu || '…'}</b>
            </div>
            <div className="mk-email-body">
              {sujetApercu && <h1>{sujetApercu}</h1>}
              {parasApercu.map((p, i) => <p key={i}>{p}</p>)}
              {parasApercu.length === 0 && <p className="mk-muted">{tr('adminMarketing.previewEmpty')}</p>}
              {form.ctaLabel.trim() && form.ctaUrl.trim() && <span className="mk-email-btn">{form.ctaLabel}</span>}
              <p className="mk-email-footer">{tr('adminMarketing.previewFooter')}</p>
            </div>
          </div>
          <p className="small mk-muted" style={{ margin: '8px 0 0' }}>{tr('adminMarketing.previewNote')}</p>
        </div>
      </aside>
    </div>
  );
}
