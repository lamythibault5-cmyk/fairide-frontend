import { useEffect, useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { euros } from '../prixPlat';
import usePageMeta from '../hooks/usePageMeta';

/* « C'est bon » en un geste (CODE-3, 8 octobre 2026, DEC-25) — /carte/valider/:token.
 *
 * Ouverte depuis un lien envoyé par SMS, WhatsApp ou e-mail, ou depuis la bannière du terminal : sans compte, la carte
 * telle que Fairide l'a préparée, avec ses prix et ses taux de TVA, et UN gros bouton. Le gérant valide ce qu'il voit —
 * l'empreinte de la carte affichée part avec le clic, et le serveur refuse si la carte a changé entre-temps
 * (lienValidationCarte.js). Le nom du responsable est prérempli : c'est lui qui signe, il peut le corriger.
 * Une seule action lime sur la page (règle 3 de l'identité) : le bouton « C'est bon ».
 *
 * Carte aux prix MAGASIN vérifiés (prixMagasin.js côté serveur) : un choix avant de valider — garder ses prix, ou ajouter
 * la commission de Fairide sur toute la carte. La liste montre alors les prix qui seront signés (calculés par le serveur,
 * priceWithFairideRate), et le choix part avec « C'est bon ». Par défaut : garder — on ne monte pas ses prix sans un geste. */
export default function ValiderCarte() {
  const { token } = useParams();
  const { t } = useLanguage();
  const id = useId();
  // Page à jeton : jamais indexée, jamais suivie (le lien est personnel).
  usePageMeta({ title: t('validerCarte.pageTitle'), robots: 'noindex, nofollow' });
  const [carte, setCarte] = useState(null);
  const [erreur, setErreur] = useState('');
  const [nom, setNom] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(null);
  const [ajouter, setAjouter] = useState(false);
  const choixOffert = !!carte?.fairideRateChoice?.offered;
  const rate = carte?.fairideRateChoice?.rate || 0;
  const avecCommission = choixOffert && ajouter;

  const charger = () => api(`/menu-validation/${encodeURIComponent(token)}`)
    .then((c) => { setCarte(c); setNom((n) => n || c.restaurant.responsibleName || ''); setErreur(''); })
    .catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function valider() {
    setEnvoi(true);
    try {
      const r = await api(`/menu-validation/${encodeURIComponent(token)}`, { method: 'POST', body: { name: nom, sha256: carte.sha256, ...(choixOffert ? { addFairideRate: ajouter } : {}) } });
      setFait(r.version);
    } catch (e) {
      setErreur(e.message);
      // Carte changée depuis l'ouverture : on recharge la version à jour, le gérant revalide ce qu'il voit.
      if (e.status === 409) charger();
    } finally { setEnvoi(false); }
  }

  if (fait) {
    return (
      <main className="container" style={{ maxWidth: 640, padding: '32px 16px' }}>
        <h1>{t('validerCarte.doneTitle')}</h1>
        <p>{t('validerCarte.doneText', { name: carte?.restaurant?.name || '' })}</p>
      </main>
    );
  }
  if (!carte) {
    return (
      <main className="container" style={{ maxWidth: 640, padding: '32px 16px' }}>
        <h1>{t('validerCarte.pageTitle')}</h1>
        <p>{erreur || t('validerCarte.loading')}</p>
      </main>
    );
  }

  const sections = [];
  for (const it of carte.items) {
    const s = sections.find((x) => x.nom === (it.category || ''));
    if (s) s.items.push(it); else sections.push({ nom: it.category || '', items: [it] });
  }
  return (
    <main className="container" style={{ maxWidth: 640, padding: '24px 16px 120px' }}>
      <h1 style={{ marginBottom: 4 }}>{carte.restaurant.name}</h1>
      <p style={{ marginTop: 0 }}>{t('validerCarte.intro')}</p>
      {carte.alreadyValidated && <p className="small" role="note">{t('validerCarte.alreadyValidated')}</p>}
      {erreur && <p role="alert" style={{ color: 'var(--red)' }}>{erreur}</p>}

      {choixOffert && (
        <section className="card" style={{ marginBottom: 12 }} aria-labelledby={`${id}-taux`}>
          <h2 id={`${id}-taux`} style={{ fontSize: 16, margin: '0 0 4px' }}>{t('validerCarte.rateTitle')}</h2>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('validerCarte.rateIntro')}</p>
          <div className="row" role="radiogroup" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" role="radio" aria-checked={!ajouter} className={!ajouter ? 'btn-teal' : 'btn-outline'} style={{ flex: '1 1 200px' }} onClick={() => setAjouter(false)}>
              {t('validerCarte.rateKeep')}
            </button>
            <button type="button" role="radio" aria-checked={ajouter} className={ajouter ? 'btn-teal' : 'btn-outline'} style={{ flex: '1 1 200px' }} onClick={() => setAjouter(true)}>
              {t('validerCarte.rateAdd', { rate: Math.round(rate * 100) })}
            </button>
          </div>
          <p className="small" style={{ margin: '10px 0 0' }}>
            {ajouter
              ? t('validerCarte.rateAddHelp', { rate: Math.round(rate * 100) })
              : t('validerCarte.rateKeepHelp', { pct: Math.round((rate / (1 + rate)) * 100) })}
          </p>
        </section>
      )}

      {sections.map((s) => (
        <section key={s.nom} className="card" style={{ marginBottom: 12 }}>
          {s.nom && <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>{s.nom}</h2>}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {s.items.map((it, k) => (
              <li key={it.id} style={{ padding: '8px 0', borderTop: k ? '1px solid var(--line)' : 'none' }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                  <b>{it.name}</b>
                  <b style={{ whiteSpace: 'nowrap' }}>{euros(avecCommission ? it.priceWithFairideRate : it.price)}</b>
                </div>
                {avecCommission && <div className="small" style={{ color: 'var(--ink-soft)', textAlign: 'right' }}>{t('validerCarte.rateWas', { price: euros(it.price) })}</div>}
                {it.desc && <div className="small" style={{ color: 'var(--ink-soft)' }}>{it.desc}</div>}
                <div className="small" style={{ color: 'var(--ink-soft)' }}>
                  {it.vatRate == null ? t('validerCarte.vatProposed') : t('validerCarte.vat', { rate: it.vatRate })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="card" style={{ position: 'sticky', bottom: 12 }}>
        <p className="small" style={{ margin: '0 0 8px' }}>{t('validerCarte.commitment')}</p>
        <div className="field">
          <label htmlFor={`${id}-nom`} className="small">{t('validerCarte.yourName')}</label>
          <input id={`${id}-nom`} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" />
        </div>
        <button type="button" className="btn-gold" style={{ width: '100%', fontSize: 20, padding: '16px 20px' }}
          disabled={envoi || nom.trim().length < 3} onClick={valider}>
          {envoi ? '…' : t('validerCarte.cestBon')}
        </button>
        <p className="small" style={{ margin: '8px 0 0' }}>{t('validerCarte.notRight')}</p>
      </div>
    </main>
  );
}
