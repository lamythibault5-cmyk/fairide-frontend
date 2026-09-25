import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { qrSvgPath } from './qr';

/* Double authentification (TOTP) — enrôlement et retrait, depuis son propre compte.
 *
 * Composant à part plutôt qu'un bloc de plus dans AdminSettingsPage : la page dépasse déjà ce qu'on
 * relit confortablement, et ce parcours a son propre état à trois temps (préparer → confirmer →
 * codes de secours) qui n'a rien à voir avec le reste de la page.
 *
 * Le QR est dessiné par components/qr.js, déjà écrit pour l'onglet Intégration des
 * réservations : générateur sans dépendance, versions 1 à 10, soit 213 octets — un lien otpauth en
 * fait environ 130. Rien à installer, et un paquet de moins à auditer (voir les entrées « dépendances
 * vulnérables » et « paquets malveillants » de la checklist de lancement).
 *
 * CE QUI SE JOUE ICI. Le secret ne transite qu'une fois, vers son propriétaire déjà authentifié, et
 * n'est jamais écrit dans un journal. Les codes de secours ne sont affichés QU'UNE FOIS : le serveur
 * n'en garde que des empreintes, donc personne — pas même l'équipe — ne peut les réafficher ensuite.
 * L'écran doit le dire, sinon quelqu'un fermera la fenêtre en se disant qu'il les retrouvera plus tard.
 */
export default function TwoFactorSetup() {
  const { t } = useLanguage();
  const { token, user, refreshUser } = useAuth();
  const toast = useToast();

  const [etape, setEtape] = useState('repos'); // repos | preparation | codes | retrait
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [codesSecours, setCodesSecours] = useState([]);
  const [occupe, setOccupe] = useState(false);

  const actif = !!user?.totpEnabled;
  const qr = otpauthUrl ? qrSvgPath(otpauthUrl) : null;

  async function preparer() {
    setOccupe(true);
    try {
      const d = await api('/auth/totp/setup', { method: 'POST', token });
      setSecret(d.secret); setOtpauthUrl(d.otpauthUrl); setCode(''); setEtape('preparation');
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  async function activer(e) {
    e.preventDefault();
    setOccupe(true);
    try {
      const d = await api('/auth/totp/enable', { method: 'POST', token, body: { code: code.trim() } });
      setCodesSecours(d.backupCodes || []);
      setEtape('codes');
      // Le secret ne doit pas traîner en mémoire une fois l'enrôlement fini.
      setSecret(''); setOtpauthUrl(''); setCode('');
      await refreshUser?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  async function retirer(e) {
    e.preventDefault();
    setOccupe(true);
    try {
      // logoutOn401: false — le serveur renvoie 401 pour un MOT DE PASSE incorrect ici, pas pour une
      // session périmée. Sans ça, se tromper de mot de passe déconnecterait, comme c'était le cas sur
      // PATCH /auth/me avant la même correction (voir api.js).
      await api('/auth/totp/disable', { method: 'POST', token, logoutOn401: false, body: { password: motDePasse, code: code.trim() } });
      setMotDePasse(''); setCode(''); setEtape('repos');
      toast(t('twofa.removed'));
      await refreshUser?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  function copierCodes() {
    navigator.clipboard.writeText(codesSecours.join('\n')).then(() => toast(t('twofa.copied')), () => toast(t('twofa.copyFailed')));
  }

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('twofa.title')}</h3>
      <p className="small" style={{ margin: '0 0 12px', color: 'var(--ink-soft)' }}>{t('twofa.intro')}</p>

      <p style={{ margin: '0 0 12px' }}>
        <span className={actif ? 'pill teal' : 'pill'}>{actif ? t('twofa.statusOn') : t('twofa.statusOff')}</span>
        {!actif && user?.isAdmin && (
          <span className="small" style={{ marginLeft: 8, color: 'var(--red)' }}>{t('twofa.adminWarning')}</span>
        )}
      </p>

      {etape === 'repos' && !actif && (
        <button type="button" className="btn-teal" disabled={occupe} onClick={preparer}>
          {occupe ? t('common.loading') : t('twofa.start')}
        </button>
      )}

      {etape === 'repos' && actif && (
        <button type="button" className="btn-outline" onClick={() => { setCode(''); setMotDePasse(''); setEtape('retrait'); }}>
          {t('twofa.disable')}
        </button>
      )}

      {etape === 'preparation' && (
        <form onSubmit={activer}>
          <p style={{ margin: '0 0 8px' }}>{t('twofa.scanHelp')}</p>
          {qr && (
            <svg viewBox={qr.viewBox} width={196} height={196} style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--line)' }} role="img" aria-label={t('twofa.qrAlt')}>
              <rect width="100%" height="100%" fill="#fff" />
              <path d={qr.d} fill="#14121F" />
            </svg>
          )}
          <p className="small" style={{ margin: '10px 0 0', color: 'var(--ink-soft)' }}>{t('twofa.manualSecret')}</p>
          <code style={{ display: 'block', wordBreak: 'break-all', margin: '4px 0 12px', fontSize: 13 }}>{secret}</code>
          <div className="field">
            <label htmlFor="twofa-code">{t('twofa.codeLabel')}</label>
            <input id="twofa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={code} onChange={(ev) => setCode(ev.target.value)} placeholder="123456" />
          </div>
          <button type="submit" className="btn-gold" disabled={occupe || code.trim().length !== 6}>
            {occupe ? t('common.loading') : t('twofa.confirm')}
          </button>
          <button type="button" className="btn-outline" style={{ marginLeft: 8 }} onClick={() => setEtape('repos')}>{t('common.cancel')}</button>
        </form>
      )}

      {etape === 'codes' && (
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>{t('twofa.backupTitle')}</h4>
          {/* Le ton est volontairement net : ces codes ne sont affichés qu'ici, et le serveur n'en
              garde que des empreintes. Personne ne pourra les retrouver. */}
          <p className="small" style={{ margin: '0 0 8px', color: 'var(--red)' }}>{t('twofa.backupHelp')}</p>
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontFamily: 'monospace', fontSize: 14 }}>
            {codesSecours.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <button type="button" className="btn-outline" onClick={copierCodes}>{t('twofa.copy')}</button>
          <button type="button" className="btn-teal" style={{ marginLeft: 8 }} onClick={() => { setCodesSecours([]); setEtape('repos'); }}>
            {t('twofa.backupDone')}
          </button>
        </div>
      )}

      {etape === 'retrait' && (
        <form onSubmit={retirer}>
          <p style={{ margin: '0 0 8px' }}>{t('twofa.disableHelp')}</p>
          <div className="field">
            <label htmlFor="twofa-pwd">{t('twofa.passwordLabel')}</label>
            <input id="twofa-pwd" type="password" autoComplete="current-password" value={motDePasse} onChange={(ev) => setMotDePasse(ev.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="twofa-code-off">{t('twofa.codeLabel')}</label>
            <input id="twofa-code-off" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={11}
              value={code} onChange={(ev) => setCode(ev.target.value)} placeholder="123456" />
          </div>
          <button type="submit" className="btn-outline" disabled={occupe || !motDePasse || !code.trim()}>
            {occupe ? t('common.loading') : t('twofa.disableConfirm')}
          </button>
          <button type="button" className="btn-teal" style={{ marginLeft: 8 }} onClick={() => setEtape('repos')}>{t('common.cancel')}</button>
        </form>
      )}
    </div>
  );
}
