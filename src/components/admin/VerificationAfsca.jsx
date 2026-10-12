import { useId, useState } from 'react';
import { apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { fmtDate } from '../../pages/admin/adminUtils';

// Outil public de l'AFSCA où l'équipe cherche l'établissement (Food Hygiene Rating, volet professionnel).
const OUTIL_AFSCA = 'https://fhr.favv-afsca.be/';

/* RELEVÉ AFSCA EN QUATRE POINTS (avis de l'avocat, 11 oct. 2026). L'AFSCA enregistre l'UNITÉ D'ÉTABLISSEMENT (numéro en
 * 2.), pas la société : chercher par numéro d'entreprise ne suffit pas. Avant ce panneau, l'équipe cochait « vérifié »
 * sans rien dire de ce qu'elle avait vu. Ici elle confirme les quatre points, joint une capture (rangée dans les
 * Documents du commerce, en privé), et le serveur garde l'adresse du moment : un déménagement le signale et ouvre une
 * tâche (routes/restaurants.js).
 *
 * FACULTATIF DEPUIS LE 12 OCT. 2026 (fondateur : « faire confiance à leur parole »). Le commerce certifie son
 * enregistrement d'une case à l'inscription ; ce relevé est un CONTRÔLE PAR SONDAGE, il ne bloque jamais la publication
 * — sauf « Introuvable » : quand l'équipe a cherché et n'a rien trouvé, publier serait vendre en connaissance de cause
 * (conformiteCommerce.js, afsca_introuvable). Écran interne : textes en fr/en/nl comme le reste de la fiche. */
const POINTS = ['linkedToCompany', 'addressIsKitchen', 'activityFood', 'statusActive'];

export default function VerificationAfsca({ detail, onChanged }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const [numero, setNumero] = useState(detail.afscaNumber || '');
  const [points, setPoints] = useState({});
  const [capture, setCapture] = useState(null);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);

  async function envoyer(result) {
    setBusy(true);
    try {
      const fields = { result, establishmentNumber: numero.trim(), sourceUrl: source.trim(), ...Object.fromEntries(POINTS.map((p) => [p, points[p] ? 'true' : 'false'])) };
      await apiUpload(`/admin/restaurants/${detail.id}/afsca-check`, { file: capture, token, fieldName: 'screenshot', fields });
      toast(result === 'trouve' ? t('adminRestos.afscaCheckSaved') : t('adminRestos.afscaNotFoundSaved'));
      setPoints({}); setCapture(null);
      onChanged?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }

  const tousLesPoints = POINTS.every((p) => points[p]);
  const etat = detail.afscaCheckResult === 'introuvable'
    ? <span style={{ color: 'var(--red)' }}>{t('adminRestos.afscaStateNotFound', { by: detail.afscaVerifiedBy || '—' })}</span>
    : detail.afscaVerifiedAt
      ? <span>✓ {t('adminRestos.afscaStateVerified', { date: fmtDate(detail.afscaVerifiedAt), by: detail.afscaVerifiedBy || '—', address: detail.afscaVerifiedAddress || '—' })}</span>
      : <span style={{ color: 'var(--red)' }}>{t('adminRestos.afscaStateTodo')}</span>;

  return (
    <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 10 }}>
      <h5 style={{ margin: '0 0 4px', fontSize: 14 }}>{t('adminRestos.afscaCheckTitle')}</h5>
      <p className="small" style={{ margin: '0 0 8px' }}>{etat}</p>
      <p className="small" style={{ margin: '0 0 8px', opacity: 0.8 }}>
        {t('adminRestos.afscaCheckHelp', { company: detail.companyNumber || '—', address: detail.address || '—' })}{' '}
        <a href={OUTIL_AFSCA} target="_blank" rel="noopener noreferrer">{t('adminRestos.afscaOpenTool')} ↗</a>
      </p>
      <div className="field" style={{ margin: '0 0 8px', maxWidth: 260 }}>
        <label htmlFor={`${ids}-num`}>{t('adminRestos.afscaEstablishmentNumber')}</label>
        <input id={`${ids}-num`} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="2.306.941.595" inputMode="numeric" />
      </div>
      {POINTS.map((p) => (
        <label key={p} className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '0 0 4px' }}>
          <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={!!points[p]} onChange={(e) => setPoints((x) => ({ ...x, [p]: e.target.checked }))} />
          <span className="small">{t(`adminRestos.afscaPoint_${p}`)}</span>
        </label>
      ))}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', margin: '8px 0' }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${ids}-cap`}>{t('adminRestos.afscaScreenshot')}</label>
          <input id={`${ids}-cap`} type="file" accept="image/*,application/pdf" onChange={(e) => setCapture(e.target.files?.[0] || null)} />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 200px' }}>
          <label htmlFor={`${ids}-src`}>{t('adminRestos.afscaSourceUrl')}</label>
          <input id={`${ids}-src`} value={source} onChange={(e) => setSource(e.target.value)} placeholder={OUTIL_AFSCA} />
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-teal" disabled={busy || !tousLesPoints || !capture || !numero.trim()} onClick={() => envoyer('trouve')}>{busy ? '…' : t('adminRestos.afscaVerifiedButton')}</button>
        <button type="button" className="btn-outline" disabled={busy} onClick={() => envoyer('introuvable')}>{t('adminRestos.afscaNotFoundButton')}</button>
      </div>
    </div>
  );
}
