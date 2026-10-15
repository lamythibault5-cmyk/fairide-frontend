import { useRef, useState } from 'react';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';
import EcranPlein from '../EcranPlein';
import { Haut, Option, Fait } from '../../pages/app/EcransBienvenue';
import { Champ } from '../../pages/app/InscriptionAppli';

/* « ENVOYER MA CARTE », DANS L'APPLICATION (2026-10-15) — le premier bouton d'un commerce qui vient de s'inscrire.
 *
 * Sur la page Ma carte, la demande tenait en un long formulaire (source en pastilles, lien, fichiers, photos, précisions,
 * puis « Envoyer » deux à trois écrans plus bas, sous un bloc légal). Ici, les écrans de l'accueil : d'où vient ta carte,
 * puis le lien ou la photo (et une précision si besoin), puis « c'est envoyé » avec ce qui se passe ensuite. Même demande
 * que MenuConciergeRequest.jsx (POST /restaurants/:id/menu/concierge, mêmes champs, mêmes règles) — qui reste la version
 * du site et l'affichage de la demande en cours. */
const SOURCES = [['website', 'globe'], ['uber_eats', 'lien'], ['deliveroo', 'lien'], ['takeaway', 'lien'], ['other', 'document']];
const NOMS = { uber_eats: 'Uber Eats', deliveroo: 'Deliveroo', takeaway: 'Takeaway.com' };
const MAX_FICHIERS = 10;
const ACCEPT = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic';

export default function EnvoiCarteAppli({ restoId, urlSuggeree = '', onEnvoyee, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [ecran, setEcran] = useState('source');
  const [recule, setRecule] = useState(false);
  const [platform, setPlatform] = useState(urlSuggeree ? 'website' : null);
  const [url, setUrl] = useState(urlSuggeree);
  const [fichiers, setFichiers] = useState([]);
  const [wantsPhotos, setWantsPhotos] = useState(true);
  const [notes, setNotes] = useState('');
  const [notesOuvertes, setNotesOuvertes] = useState(false);
  const [erreur, setErreur] = useState('');
  const [busy, setBusy] = useState(false);
  const [demande, setDemande] = useState(null);
  const choixFichiers = useRef(null);

  const libelle = (p) => NOMS[p] || t(`menuConcierge.source_${p}`);
  const enLigne = platform !== 'other';

  function ajouterFichiers(liste) {
    const nouveaux = Array.from(liste || []);
    if (!nouveaux.length) return;
    setErreur('');
    setFichiers((f) => {
      const tous = [...f, ...nouveaux.filter((n) => !f.some((x) => x.name === n.name && x.size === n.size))];
      if (tous.length > MAX_FICHIERS) toast(t('menuConcierge.filesTooMany', { n: MAX_FICHIERS }), 'erreur');
      return tous.slice(0, MAX_FICHIERS);
    });
  }

  async function envoyer() {
    // Même règle que la version du site : sans carte en ligne, il faut un lien, une photo / un PDF ou une précision.
    if (!enLigne && !url.trim() && !fichiers.length && !notes.trim()) { setErreur(t('menuConcierge.errNeedSource')); return; }
    setBusy(true);
    try {
      const photos = enLigne ? true : wantsPhotos;
      const r = fichiers.length
        ? await apiUpload(`/restaurants/${restoId}/menu/concierge`, { files: fichiers, token, fieldName: 'files', fields: { platform, url: url.trim(), notes: notes.trim(), wantsPhotos: photos ? 'true' : 'false' } })
        : await api(`/restaurants/${restoId}/menu/concierge`, { method: 'POST', token, body: { platform, url: url.trim(), notes: notes.trim(), wantsPhotos: photos } });
      setDemande(r.request);
      setRecule(false); setEcran('envoye');
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }

  function retour() {
    if (ecran === 'details') { setRecule(true); setErreur(''); setEcran('source'); return; }
    if (ecran === 'envoye') { onEnvoyee?.(demande); return; }
    onFermer();
  }

  let contenu;
  let bouton;
  if (ecran === 'source') {
    contenu = (
      <>
        <h1 className="bv-titre bv-titre-form">{t('appli.carteSourceTitre')}</h1>
        <p className="bv-sous">{t('menuConcierge.sourceHelp')}</p>
        {SOURCES.map(([p, icone]) => <Option key={p} icone={icone} on={platform === p} titre={libelle(p)} onClick={() => setPlatform(p)} />)}
      </>
    );
    bouton = <button type="button" className="bv-btn btn-teal" disabled={!platform} onClick={() => { setRecule(false); setEcran('details'); }}>{t('appli.continuer')}</button>;
  } else if (ecran === 'details') {
    contenu = (
      <>
        <h1 className="bv-titre bv-titre-form">{enLigne ? t('appli.carteLienTitre', { source: libelle(platform) }) : t('appli.carteFichierTitre')}</h1>
        {enLigne ? (
          <>
            <p className="bv-sous">{t('menuConcierge.photosSameSource', { source: libelle(platform) })}</p>
            <Champ id="carte-url" label={t('menuConcierge.urlLabel')} aide={t('menuConcierge.urlHelp')}>
              <input id="carte-url" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </Champ>
          </>
        ) : (
          <>
            <p className="bv-sous">{t('menuConcierge.filesHelp')}</p>
            <input ref={choixFichiers} type="file" accept={ACCEPT} multiple style={{ display: 'none' }} onChange={(e) => { ajouterFichiers(e.target.files); e.target.value = ''; }} />
            <button type="button" className="bv-option" disabled={fichiers.length >= MAX_FICHIERS} onClick={() => choixFichiers.current?.click()}>
              <span className="bv-tuile"><Icone nom="apercu" taille={20} /></span><span>{t('menuConcierge.filesButton')}</span>
            </button>
            {fichiers.map((f) => (
              <div key={`${f.name}-${f.size}`} className="bv-fichier">
                <Icone nom={/^image\//.test(f.type) ? 'apercu' : 'document'} taille={16} />
                <span>{f.name}</span>
                <button type="button" className="bv-rond" aria-label={t('menuConcierge.filesRemove')} onClick={() => setFichiers((l) => l.filter((x) => x !== f))}><Icone nom="croix" taille={14} /></button>
              </div>
            ))}
            <span className="bv-etiquette" id="carte-photos">{t('menuConcierge.photosTitle')}</span>
            <div className="bv-segments" role="radiogroup" aria-labelledby="carte-photos">
              {[[true, t('appli.cartePhotosOui')], [false, t('appli.cartePhotosNon')]].map(([v, txt]) => (
                <button key={String(v)} type="button" role="radio" aria-checked={wantsPhotos === v} className={wantsPhotos === v ? 'on' : ''} onClick={() => setWantsPhotos(v)}>{txt}</button>
              ))}
            </div>
          </>
        )}
        {notesOuvertes ? (
          <Champ id="carte-notes" label={t('menuConcierge.notesLabel')}>
            <textarea id="carte-notes" rows={2} value={notes} onChange={(e) => { setNotes(e.target.value); setErreur(''); }} placeholder={t('menuConcierge.notesPlaceholder')} />
          </Champ>
        ) : (
          <button type="button" className="bv-ajout" onClick={() => setNotesOuvertes(true)}>＋ {t('appli.carteNote')}</button>
        )}
        {erreur && <p className="field-error" role="alert">{erreur}</p>}
      </>
    );
    bouton = (
      <>
        {/* L'autorisation d'accès donnée en confiant sa carte : dite juste avant d'envoyer, comme sur le site. */}
        <p className="bv-aide" style={{ marginBottom: 4 }}>{t('menuConcierge.accessNote')}</p>
        <button type="button" className="bv-btn btn-gold" disabled={busy} onClick={envoyer}>{busy ? t('menuConcierge.sending') : t('appli.carteEnvoyer')}</button>
      </>
    );
  } else {
    contenu = (
      <>
        <h1 className="bv-titre bv-titre-form">{t('appli.carteEnvoyeeTitre')}</h1>
        <p className="bv-sous">{t('menuConcierge.delay')}</p>
        <Fait icone="carte" titre={t('menuConcierge.next1Title')} sous={t('menuConcierge.next1')} />
        <Fait icone="valider" titre={t('menuConcierge.next2Title')} sous={t('menuConcierge.next2')} />
        <Fait icone="crayon" titre={t('menuConcierge.next3Title')} sous={t('menuConcierge.next3')} />
      </>
    );
    bouton = <button type="button" className="bv-btn btn-teal" onClick={() => onEnvoyee?.(demande)}>{t('appli.carteFini')}</button>;
  }

  return (
    <EcranPlein etiquette={t('miseEnLigne.menuSend')}>
      <main className={`bv-ecran${recule ? ' bv-ecran--retour' : ''}`} key={ecran}>
        <Haut onRetour={retour} progression={ecran === 'source' ? 1 / 3 : ecran === 'details' ? 2 / 3 : 1} />
        <div className="bv-form">
          {contenu}
          <div className="bv-grandit" />
          {bouton}
        </div>
      </main>
    </EcranPlein>
  );
}
