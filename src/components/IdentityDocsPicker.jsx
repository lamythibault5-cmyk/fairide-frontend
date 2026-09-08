import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Choix des photos de la pièce d'identité à l'inscription d'un livreur (voir Auth.jsx, étape « documents ») :
// carte d'identité OU permis de conduire, recto et verso obligatoires, attestation étudiant en option. Les
// fichiers restent dans le navigateur tant que le compte n'est pas créé ; ils partent ensuite vers
// /couriers/me/documents (voir televerserDocumentsLivreur dans Auth.jsx) et se retrouvent dans « Mon compte ».
export const KINDS = ['identity_card', 'driving_licence'];

function Apercu({ file }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setUrl(null); return undefined; }
    const u = URL.createObjectURL(file); setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!file) return <span className="doc-slot-vide" aria-hidden="true">📷</span>;
  if (url) return <img className="doc-slot-img" src={url} alt="" />;
  return <span className="doc-slot-vide" aria-hidden="true">📄</span>;
}

export function DocSlot({ id, label, file, onFile, invalid, optional = false, accept = 'image/*,application/pdf' }) {
  const { t } = useLanguage();
  return (
    <div className={`doc-slot${invalid ? ' input-invalid' : ''}${file ? ' rempli' : ''}`}>
      <label htmlFor={id} className="doc-slot-body">
        <Apercu file={file} />
        <span className="doc-slot-texte">
          <b>{label}</b>{optional && <span className="small"> · {t('authDocs.optional')}</span>}
          <span className="small">{file ? file.name : t('authDocs.tapToAdd')}</span>
        </span>
      </label>
      <input id={id} type="file" accept={accept} capture="environment" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      {file && <button type="button" className="btn-ghost doc-slot-retirer" onClick={() => onFile(null)} aria-label={t('authDocs.remove')}>✕</button>}
    </div>
  );
}

export default function IdentityDocsPicker({ kind, setKind, recto, setRecto, verso, setVerso, student, setStudent, errors = {} }) {
  const { t } = useLanguage();
  return (
    <div>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('authDocs.intro')}</p>
      <div className="role-pick" style={{ marginBottom: 10 }}>
        {KINDS.map((k) => (
          <div key={k} role="radio" aria-checked={kind === k} tabIndex={0} className={`chip${kind === k ? ' active' : ''}`} onClick={() => setKind(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setKind(k); }}>
            {k === 'identity_card' ? '🪪 ' : '🚗 '}{t(`courierOnboarding.doc_${k}`)}
          </div>
        ))}
      </div>
      <div className="doc-slots">
        <DocSlot id="auth-doc-recto" label={t('authDocs.front')} file={recto} onFile={setRecto} invalid={!!errors.docRecto} />
        <DocSlot id="auth-doc-verso" label={t('authDocs.back')} file={verso} onFile={setVerso} invalid={!!errors.docVerso} />
      </div>
      {(errors.docRecto || errors.docVerso) && <p className="field-error">{errors.docRecto || errors.docVerso}</p>}
      <div style={{ marginTop: 12 }}>
        <DocSlot id="auth-doc-student" label={t('authDocs.student')} file={student} onFile={setStudent} optional />
        <p className="small" style={{ margin: '4px 0 0' }}>{t('authDocs.studentHelp')}</p>
      </div>
      <p className="small" style={{ margin: '10px 0 0', opacity: 0.8 }}>{t('authDocs.privacy')}</p>
    </div>
  );
}
