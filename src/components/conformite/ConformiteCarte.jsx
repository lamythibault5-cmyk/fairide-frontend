import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, apiDownload, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { mouvementReduit } from '../../gestes';
import AllergenesPlat from './AllergenesPlat';
import { ouvrirValidationCarte } from '../commerce/useMiseEnLigne';

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
// `versEngagements` (côté commerce, Ma carte) : la procédure allergènes et la déclaration de vendeur professionnel ne se signent
// plus ici mais sur « Tes engagements » (fondateur, 2026-10-27, S1 de maquettes/audit-ecrans) — deux écrans de signature qui ne
// se ressemblaient pas, l'un en long texte à puces avec un « Tout signer (2) » grisé. Ici il ne reste qu'une rangée qui y mène ;
// LA CARTE NON PLUS (revue des doublons, 2026-10-27 : « on ne peut pas avoir deux processus qui font la même chose »). Ce panneau
// la signait encore (POST /menu/sign, un nom tapé) à côté de « C'est bon » (empreinte de la carte, choix de la hausse) : il mène
// maintenant à « C'est bon » par « Relire ma carte », le même code que l'étape du tableau de bord (ouvrirValidationCarte). Il ne
// signe plus rien. En console admin (`modeAdmin`) : l'état seul, l'équipe ne signe pas à la place du commerce.
export default function ConformiteCarte({ restoId, rafraichir, onChange, versEngagements = null, modeAdmin = false }) {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);

  const charger = () => api(`/restaurants/${restoId}/compliance`, { token }).then(setD).catch(() => {});
  useEffect(() => { if (restoId) charger(); }, [restoId, rafraichir]); // eslint-disable-line react-hooks/exhaustive-deps
  // Arrivée par « Signer mes engagements » (liste Avant d'être en ligne, lien …/menu#conformite-carte) : le routeur ne
  // défile pas vers une ancre, et ce panneau n'existe qu'une fois ses données reçues. On y va nous-mêmes, une fois.
  const ancreFaite = useRef(false);
  useEffect(() => {
    if (!d || ancreFaite.current || window.location.hash !== '#conformite-carte') return;
    ancreFaite.current = true;
    document.getElementById('conformite-carte')?.scrollIntoView({ behavior: mouvementReduit() ? 'auto' : 'smooth', block: 'start' });
  }, [d]);

  if (!d) return null;
  const date = (ms) => new Date(ms).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const m = d.menu;
  const pro = d.professional;
  const proAJour = !!pro.declaredAt && pro.upToDate !== false;

  // Ce qui reste à signer, dans l'ordre où le serveur l'attend. La carte n'y entre que si elle est signable (des plats,
  // rien qui manque) : tant que Fairide la prépare, il n'y a rien à signer et on le dit.
  const aSignerTout = [];
  if (!m.signed && m.missing.length === 0 && m.itemCount > 0) aSignerTout.push('carte');
  if (!d.allergens.attestation.attestedAt) aSignerTout.push('allergenes');
  if (!proAJour) aSignerTout.push('pro');
  const ailleurs = versEngagements ? aSignerTout.filter((x) => x !== 'carte') : [];
  const aSigner = versEngagements ? aSignerTout.filter((x) => x === 'carte') : aSignerTout;
  const toutSigne = m.signed && d.allergens.attestation.attestedAt && proAJour;

  async function relireCarte() {
    setBusy(true);
    try { await ouvrirValidationCarte({ restaurant: rafraichir, restoId, token, navigate, onChange, toast, t }); }
    catch (err) { toast(err.message, 'erreur'); }
    finally { setBusy(false); }
  }

  const fait = (texte) => <p className="small" style={{ margin: '2px 0 0' }}>✓ {texte}</p>;

  return (
    <details className="card conformite-carte" id="conformite-carte" open={!toutSigne}>
      <summary>
        <b>{t('conformite.menuPanelTitle')}</b>{' '}
        {toutSigne ? <span className="pill teal">✓ {t('conformite.menuPanelDone')}</span> : <span className="pill texte-erreur">{t('conformite.signAllCount', { n: aSignerTout.length || 1 })}</span>}
      </summary>

      {/* Déjà signé : une ligne chacun, rien d'autre. */}
      <div style={{ marginTop: 10 }}>
        {m.signed && fait(t('conformite.menuSigned', { date: m.lastSigned?.signedAt ? date(m.lastSigned.signedAt) : '', name: m.lastSigned?.signedName || '' }))}
        {d.allergens.attestation.attestedAt && fait(t('conformite.allergenAttested', { date: date(d.allergens.attestation.attestedAt), name: d.allergens.attestation.attestedName }))}
        {proAJour && fait(t('conformite.proDeclared', { date: date(pro.declaredAt), name: pro.declaredName }))}
      </div>
      {ailleurs.length > 0 && (
        <Link to={versEngagements} className="conformite-vers">
          <span><b>{t('engagementsCommerce.titre')}</b><small>{ailleurs.length === 1 ? t('ecranCommerce.engagementsLigneUn') : t('ecranCommerce.engagementsLigne', { n: ailleurs.length })}</small></span>
          <span className="conformite-vers-chevron" aria-hidden="true">›</span>
        </Link>
      )}

      {/* Carte pas encore signable : on dit pourquoi, sans formulaire. */}
      {!m.signed && !aSigner.includes('carte') && (
        <div style={{ marginTop: 10 }}>
          {m.itemCount === 0
            ? <p className="small" style={{ margin: 0 }}>{t('conformite.menuNotReadyYet')}</p>
            : (
              <>
                <p className="small" style={{ margin: '0 0 4px', color: 'var(--red)' }}>{t('conformite.menuMissingCount', { n: m.missing.length })}</p>
                <ul className="small" style={{ margin: '0 0 6px 18px' }}>
                  {/* Allergènes manquants : déclarables ici, plat par plat (AllergenesPlat) — tous affichés, pas seulement les
                      huit premiers, puisque chacun a maintenant son bouton. */}
                  {m.missing.filter((x) => x.code === 'ALLERGENES_NON_DECLARES').map((x) => (
                    <li key={`${x.itemId}-${x.code}`} style={{ marginBottom: 6 }}>{x.name} — {t(`conformite.menuMissing_${x.code}`)}
                      <AllergenesPlat restoId={restoId} token={token} plat={x} onEnregistre={() => { charger(); onChange?.(); }} />
                    </li>
                  ))}
                  {m.missing.filter((x) => x.code !== 'ALLERGENES_NON_DECLARES').slice(0, 8).map((x) => <li key={`${x.itemId}-${x.code}`}>{x.name} — {t(`conformite.menuMissing_${x.code}`)}</li>)}
                  {m.missing.filter((x) => x.code !== 'ALLERGENES_NON_DECLARES').length > 8 && <li>…</li>}
                </ul>
              </>
            )}
        </div>
      )}

      {!modeAdmin && aSigner.includes('carte') && (
        <section className="conformite-bloc" style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 4px' }}>{t('conformite.menuSignTitle')}</h4>
          <p className="small" style={{ margin: '0 0 8px' }}>{m.lastSigned ? t('conformite.menuChangedSinceSigned') : t('conformite.menuNeverSigned')}</p>
          <button type="button" className="btn-gold btn-sm" disabled={busy} onClick={relireCarte}>{busy ? '…' : t('miseEnLigne.validateBtn')}</button>
        </section>
      )}
      {!modeAdmin && !versEngagements && aSigner.some((x) => x !== 'carte') && (
        <button type="button" className="btn-gold btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/dashboard/engagements')}>{t('miseEnLigne.commitmentsBtn')}</button>
      )}

      {m.lastSigned && <p className="small" style={{ margin: '10px 0 0' }}><a href={`${API_BASE}/restaurants/${restoId}/menu/versions?download=1`} onClick={async (e) => {
        e.preventDefault();
        try {
          // apiDownload, pas un <a download> sur un Blob : dans l'app la WebView l'ignorait, rien ne se passait (audit du 19/10,
          // shop-17). Le fichier part dans la feuille de partage du téléphone, comme les relevés.
          await apiDownload(`/restaurants/${restoId}/menu/versions`, { token, filename: `cartes-signees-${restoId}.json` });
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
