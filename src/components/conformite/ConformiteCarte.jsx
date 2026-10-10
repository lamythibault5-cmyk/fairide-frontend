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
 *   A8 — déclarer vendre en tant que professionnel ; depuis PRO-2026.2, la même déclaration certifie
 *        l'enregistrement AFSCA, les autorisations et les assurances (plus de numéro ni de pièce exigés).
 *   A4 — rappeler que les plats alcoolisés restent masqués sans autorisation accises vérifiée.
 *
 * UNE CASE, UN NOM, UN BOUTON (fondateur, simulation du 10 oct. 2026). C'étaient trois formulaires l'un sous l'autre,
 * chacun avec sa case, son champ « nom complet » et son bouton : trois fois la même saisie, et un restaurateur testeur
 * ne savait plus ce qui restait à faire. Désormais : la liste de ce qui reste à signer, textes visibles, une seule case
 * « j'atteste l'ensemble », le nom tapé une fois, un bouton. Côté serveur rien ne change — chaque engagement garde sa
 * route, sa version et son empreinte SHA-256 : le bouton les envoie l'un après l'autre. Signer ensemble des textes
 * qu'on a sous les yeux reste une signature de chacun d'eux. */
// `rafraichir` : la fiche du commerce, rechargée après chaque modification de plat — un prix changé
// remet la carte à signer, le panneau doit le montrer sans recharger la page.
export default function ConformiteCarte({ restoId, rafraichir, onChange }) {
  const { token } = useAuth();
  const toast = useToast();
  const { t, language } = useLanguage();
  // Engagements signés : le français fait foi (il est haché avec la signature) ; en anglais et en néerlandais on montre
  // la traduction envoyée par le serveur, le texte français restant à un clic (plan de test DEV-7).
  const traduit = (bloc) => (language !== 'fr' && bloc?.translations?.[language]) || null;
  const noteFoi = (original) => (
    <details className="small" style={{ margin: '0 0 6px' }}>
      <summary>{t('conformite.frenchPrevails')}</summary>
      {Array.isArray(original) ? <ul style={{ margin: '4px 0 0 18px' }}>{original.map((l) => <li key={l} lang="fr">{l}</li>)}</ul> : <p lang="fr" style={{ margin: '4px 0 0' }}>{original}</p>}
    </details>
  );
  const id = useId();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nom, setNom] = useState('');
  const [coche, setCoche] = useState(false);
  const [tel, setTel] = useState('');
  const [referent, setReferent] = useState('');

  const charger = () => api(`/restaurants/${restoId}/compliance`, { token }).then((r) => {
    setD(r);
    setTel((x) => x || r.allergens.contactPhone || r.allergens.fallbackPhone || '');
    setReferent((x) => x || r.allergens.referentName || '');
  }).catch(() => {});
  useEffect(() => { if (restoId) charger(); }, [restoId, rafraichir]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return null;
  const date = (ms) => new Date(ms).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const m = d.menu;
  const pro = d.professional;
  const proAJour = !!pro.declaredAt && pro.upToDate !== false;

  // Ce qui reste à signer, dans l'ordre où le serveur l'attend. La carte n'y entre que si elle est signable (des plats,
  // rien qui manque) : tant que Fairide la prépare, il n'y a rien à signer et on le dit.
  const aSigner = [];
  if (!m.signed && m.missing.length === 0 && m.itemCount > 0) aSigner.push('carte');
  if (!d.allergens.attestation.attestedAt) aSigner.push('allergenes');
  if (!proAJour) aSigner.push('pro');
  const toutSigne = m.signed && d.allergens.attestation.attestedAt && proAJour;

  async function toutSigner(e) {
    e.preventDefault();
    const typedName = nom.trim();
    setBusy(true);
    try {
      // L'un après l'autre : si l'un échoue (numéro d'allergènes invalide, dénomination manquante…), les précédents
      // restent signés et le panneau rechargé montre exactement ce qui reste.
      for (const quoi of aSigner) {
        if (quoi === 'carte') await api(`/restaurants/${restoId}/menu/sign`, { method: 'POST', token, body: { typedName, confirmed: true } });
        if (quoi === 'allergenes') await api(`/restaurants/${restoId}/allergens/attest`, { method: 'POST', token, body: { typedName, confirmed: true, contactPhone: tel.trim(), referentName: referent.trim() } });
        if (quoi === 'pro') await api(`/restaurants/${restoId}/professional-declaration`, { method: 'POST', token, body: { typedName, confirmed: true } });
      }
      toast(t('conformite.signAllToast'));
      setCoche(false);
      onChange?.();
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      await charger();
      setBusy(false);
    }
  }

  const fait = (texte) => <p className="small" style={{ margin: '2px 0 0' }}>✓ {texte}</p>;

  return (
    <details className="card conformite-carte" open={!toutSigne}>
      <summary>
        <b>{t('conformite.menuPanelTitle')}</b>{' '}
        {toutSigne ? <span className="pill teal">✓ {t('conformite.menuPanelDone')}</span> : <span className="pill" style={{ color: 'var(--red)' }}>{t('conformite.signAllCount', { n: aSigner.length || 1 })}</span>}
      </summary>

      {/* Déjà signé : une ligne chacun, rien d'autre. */}
      <div style={{ marginTop: 10 }}>
        {m.signed && fait(t('conformite.menuSigned', { date: m.lastSigned?.signedAt ? date(m.lastSigned.signedAt) : '', name: m.lastSigned?.signedName || '' }))}
        {d.allergens.attestation.attestedAt && fait(t('conformite.allergenAttested', { date: date(d.allergens.attestation.attestedAt), name: d.allergens.attestation.attestedName }))}
        {proAJour && fait(t('conformite.proDeclared', { date: date(pro.declaredAt), name: pro.declaredName }))}
      </div>

      {/* Carte pas encore signable : on dit pourquoi, sans formulaire. */}
      {!m.signed && !aSigner.includes('carte') && (
        <div style={{ marginTop: 10 }}>
          {m.itemCount === 0
            ? <p className="small" style={{ margin: 0 }}>{t('conformite.menuNotReadyYet')}</p>
            : (
              <>
                <p className="small" style={{ margin: '0 0 4px', color: 'var(--red)' }}>{t('conformite.menuMissingCount', { n: m.missing.length })}</p>
                <ul className="small" style={{ margin: '0 0 6px 18px' }}>
                  {m.missing.slice(0, 8).map((x) => <li key={`${x.itemId}-${x.code}`}>{x.name} — {t(`conformite.menuMissing_${x.code}`)}</li>)}
                  {m.missing.length > 8 && <li>…</li>}
                </ul>
              </>
            )}
        </div>
      )}

      {aSigner.length > 0 && (
        <form onSubmit={toutSigner} style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('conformite.signAllIntro')}</p>

          {aSigner.includes('carte') && (
            <section className="conformite-bloc">
              <h4 style={{ margin: '0 0 4px' }}>{t('conformite.menuSignTitle')}</h4>
              <p className="small" style={{ margin: '0 0 4px' }}>{m.lastSigned ? t('conformite.menuChangedSinceSigned') : t('conformite.menuNeverSigned')}</p>
              {/* Pas de liste « taux de TVA à indiquer » plat par plat : le serveur pose le taux proposé à la signature
                  (carteSignee.signer). On annonce la règle ici, pour qu'il signe en sachant ce qu'il signe. */}
              {m.vatAutoCount > 0 && <p className="small" style={{ margin: '0 0 4px', color: 'var(--ink-soft)' }}>{t('conformite.menuVatAuto')}</p>}
              <p className="small" style={{ margin: 0 }}>{traduit(m) || m.text}</p>
              {traduit(m) && noteFoi(m.text)}
            </section>
          )}

          {aSigner.includes('allergenes') && (
            <section className="conformite-bloc" style={{ marginTop: 12 }}>
              <h4 style={{ margin: '0 0 4px' }}>{t('conformite.allergenAttestTitle')}</h4>
              <ul className="small" style={{ margin: '0 0 6px 18px' }}>{(traduit(d.allergens.attestation) || d.allergens.attestation.text || []).map((l) => <li key={l}>{l}</li>)}</ul>
              {traduit(d.allergens.attestation) && noteFoi(d.allergens.attestation.text)}
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
            </section>
          )}

          {aSigner.includes('pro') && (
            <section className="conformite-bloc" style={{ marginTop: 12 }}>
              <h4 style={{ margin: '0 0 4px' }}>{t('conformite.proTitle')}</h4>
              {pro.declaredAt && <p className="small" style={{ margin: '0 0 4px' }}>{t('conformite.proNewVersion')}</p>}
              <ul className="small" style={{ margin: '0 0 6px 18px' }}>{(traduit(pro) || pro.text || []).map((l) => <li key={l}>{l}</li>)}</ul>
              {traduit(pro) && noteFoi(pro.text)}
            </section>
          )}

          <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginTop: 12 }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={coche} onChange={(e) => setCoche(e.target.checked)} />
            <span className="small" style={{ fontWeight: 600 }}>{t('conformite.signAllCheck')}</span>
          </label>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <label htmlFor={`${id}-nom`} className="sr-only">{t('conformite.typedName')}</label>
            <input id={`${id}-nom`} placeholder={t('conformite.typedName')} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" style={{ maxWidth: 260 }} />
            <button type="submit" className="btn-teal" disabled={busy || !coche || nom.trim().length < 3 || (aSigner.includes('allergenes') && !tel.trim())}>
              {busy ? '…' : t('conformite.signAllButton', { n: aSigner.length })}
            </button>
          </div>
        </form>
      )}

      {m.lastSigned && <p className="small" style={{ margin: '10px 0 0' }}><a href={`${API_BASE}/restaurants/${restoId}/menu/versions?download=1`} onClick={async (e) => {
        e.preventDefault();
        try {
          const r = await api(`/restaurants/${restoId}/menu/versions`, { token });
          const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
          const a = document.createElement('a'); a.href = url; a.download = `cartes-signees-${restoId}.json`; a.click(); URL.revokeObjectURL(url);
        } catch (err) { toast(err.message, 'erreur'); }
      }}>{t('conformite.menuVersionsExport')}</a></p>}

      {/* Alcool fermé au lancement (DEC-22, ALCOHOL_ENABLED côté serveur) : les plats sont masqués pour tous, avec ou
          sans autorisation — on ne réclame donc pas la pièce AGD&A au commerce, on lui dit pourquoi. */}
      {d.alcohol.alcoholItems > 0 && d.alcohol.salesOpen === false && (
        <p className="small" style={{ marginTop: 16 }}>{t('conformite.alcoholClosed', { n: d.alcohol.alcoholItems })}</p>
      )}
      {/* A4 — alcool sans autorisation */}
      {d.alcohol.alcoholItems > 0 && d.alcohol.salesOpen !== false && !d.alcohol.authorized && (
        <p className="small" style={{ marginTop: 16, color: 'var(--red)' }}>{t('conformite.alcoholHidden', { n: d.alcohol.alcoholItems })}</p>
      )}
    </details>
  );
}
