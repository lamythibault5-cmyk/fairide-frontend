import { useId, useState } from 'react';
import { apiDownload } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

/* Copie des informations DAC7 déclarées pour une année (backlog A10 et B8 ; art. 321septies §4 CIR 92).
 *
 * Même composant pour le livreur (/couriers/me/dac7/…) et pour le commerce (/restaurants/:id/dac7/…) :
 * `chemin(annee)` rend l'adresse. L'année proposée par défaut est la dernière close — celle que Fairide
 * déclare avant le 31/01. Pas d'activité cette année-là : le serveur répond 404 avec un message clair,
 * affiché tel quel. */
export default function CopieDac7({ chemin, token }) {
  const { t } = useLanguage();
  const toast = useToast();
  const id = useId();
  const derniere = new Date().getFullYear() - 1;
  const [annee, setAnnee] = useState(derniere);
  const [occupe, setOccupe] = useState(false);
  async function telecharger() {
    setOccupe(true);
    try { await apiDownload(chemin(annee), { token, filename: `fairide-dac7-${annee}.pdf` }); }
    catch (e) { toast(e.message, 'erreur'); }
    finally { setOccupe(false); }
  }
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 10, marginTop: 10, borderTop: '1px solid var(--line)' }}>
      <span className="small" style={{ flex: '1 1 180px' }}>{t('conformite.dac7CopyLabel')}</span>
      <select aria-label={t('conformite.dac7Year')} id={`${id}-an`} value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={{ width: 'auto' }}>
        {[derniere, derniere - 1].map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <button type="button" className="btn-ghost" style={{ padding: '2px 8px' }} disabled={occupe} onClick={telecharger}>{occupe ? '…' : t('conformite.saleDocsOpen')}</button>
    </div>
  );
}
