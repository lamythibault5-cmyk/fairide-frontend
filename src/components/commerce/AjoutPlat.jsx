import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { categoryLabel } from '../../menuCategories';
import { euros } from '../../prixPlat';
import { vibrer } from '../../gestes';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import Modale from '../Modale';
import Icone from '../Icone';
import { lirePrix, prixSurFairride } from './ajoutPlatOutils';

/* LE COMMERCE AJOUTE UN PLAT, CHANGE UN PRIX, MET UNE PHOTO (fondateur, 2026-10-29, réponses à maquettes/ajout-plat).
 *   1. Photo : le carré « + photo » sur chaque plat sans photo ET la bande « N plats sans photo » en rafale. En ligne tout de
 *      suite ; l'équipe la retire depuis la console si elle ne va pas.
 *   3. Ajouter un plat : une seule feuille (photo, nom, section, prix du comptoir), puis l'écran sur l'honneur.
 *   4. Le commerce tape le prix de son COMPTOIR, jamais un pourcentage : Fairride calcule le prix affiché avec la règle de sa
 *      carte (prixSurFairride, copie de prixMagasin.prixAvecHausse côté serveur, qui reste seul juge).
 *   5. Sur l'honneur : le bouton EST la déclaration (« Oui, 12,00 € au comptoir »).
 *   6. À chaque nouveau plat et à chaque prix changé.
 *   7. Si le prix est faux : le badge « Prix du comptoir » part, RIEN D'AUTRE. L'écran ne menace donc de rien d'autre, et
 *      un commerce sans badge (hausse, ou prix pas encore relevés) ne lit aucune menace : seulement que sa réponse est gardée.
 *   8. Personne ne contrôle : aucun texte ne dit « on vérifie ».
 *   9. Sur le site large : la même feuille en deux moitiés, le formulaire à gauche, la déclaration à droite.
 * Le serveur garde chaque déclaration (plat, prix, nom, date ; routes/restaurants.js › /menu/declare, declarationPrix.js) et
 * re-signe la carte si elle était signée : sinon un plat ajouté rendait le commerce incommandable. */

// La bande « N plats sans photo » : ouvre la rafale.
export function BandePhotos({ n, onOuvrir }) {
  const { t } = useLanguage();
  if (!n) return null;
  return (
    <div className="ec-bande-photos">
      <Icone nom="photo" taille={24} />
      <span><b>{n === 1 ? t('carteAjout.rafaleBande1') : t('carteAjout.rafaleBande', { n })}</b><small>{t('carteAjout.rafaleSous')}</small></span>
      <button type="button" onClick={onOuvrir}>{t('carteAjout.rafaleOuvrir')}</button>
    </div>
  );
}

// La rafale : un plat par écran, une photo, le suivant. La liste est figée à l'ouverture (un plat photographié ne disparaît
// pas sous le doigt).
export function RafalePhotos({ plats, photo, onFermer }) {
  const { t } = useLanguage();
  const [liste] = useState(plats);
  const [i, setI] = useState(0);
  const [apercu, setApercu] = useState(null);
  const champ = useRef(null);
  const plat = liste[i];
  const fini = i >= liste.length;
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);
  async function prise(f) {
    const url = URL.createObjectURL(f);
    setApercu(url);
    const ok = await photo.envoyer(plat, f);
    if (ok) setTimeout(() => { setApercu(null); setI((x) => x + 1); }, 450);
    else setApercu(null);
  }
  return (
    <Modale ariaLabel={t('carteAjout.rafaleOuvrir')} onFermer={onFermer} classeBoite="ec-ajout">
      <div className="ec-rafale-haut">
        <span>{fini ? '' : t('carteAjout.rafaleCompte', { i: i + 1, n: liste.length })}</span>
        <button type="button" className="ec-lien" onClick={onFermer}>{t('carteAjout.fermer')}</button>
      </div>
      <div className="ec-rafale-barre" aria-hidden="true"><i style={{ width: `${Math.round((Math.min(i + 1, liste.length) / liste.length) * 100)}%` }} /></div>
      {fini ? (
        <>
          <h2 className="ec-ajout-titre">{t('carteAjout.rafaleFin')}</h2>
          <button type="button" className="ec-bouton ec-bouton--lime" onClick={onFermer}>{t('carteAjout.retour')}</button>
        </>
      ) : (
        <>
          <h2 className="ec-ajout-titre">{plat.name}</h2>
          {plat.desc && <p className="ec-ajout-sous">{plat.desc}</p>}
          <button type="button" className="ec-rafale-cadre" onClick={() => champ.current?.click()} aria-label={t('carteAjout.photoPour', { name: plat.name })}>
            {apercu ? <img src={apercu} alt="" /> : <Icone nom="photo" taille={48} />}
          </button>
          <input ref={champ} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) prise(f); }} />
          <button type="button" className="ec-bouton ec-bouton--lime" disabled={!!photo.envoi} onClick={() => champ.current?.click()}>
            {photo.envoi ? t('carteAjout.photoEnvoi') : t('carteAjout.rafalePrendre')}
          </button>
          <button type="button" className="ec-bouton ec-bouton--texte" onClick={() => setI((x) => x + 1)}>{t('carteAjout.rafalePasser')}</button>
        </>
      )}
    </Modale>
  );
}

/* LA FEUILLE : nouveau plat (`plat` absent) ou nouveau prix d'un plat. Trois temps : le formulaire, la déclaration, le
 * tampon « C'est déclaré ». Sur le site large, formulaire et déclaration côte à côte. */
export function FeuillePlat({ restoId, token, restaurant, regle, plat = null, onFermer, onFait }) {
  const { t } = useLanguage();
  const toast = useToast();
  const large = useSiteLarge(900);
  const sections = (restaurant.sections || []).map((s) => s.name);
  const [etape, setEtape] = useState('form');
  const [nom, setNom] = useState('');
  const [desc, setDesc] = useState('');
  const [section, setSection] = useState(sections[0] || '');
  const [nouvelle, setNouvelle] = useState(false);
  const [prix, setPrix] = useState('');
  const [photo, setPhoto] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(null);
  const champPhoto = useRef(null);
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  const nomPlat = plat ? plat.name : nom.trim();
  const comptoir = lirePrix(prix);
  const affiche = comptoir === null ? null : prixSurFairride(comptoir, regle.pourcent);
  const manque = !plat && !nomPlat ? 'manqueNom' : !plat && !section.trim() ? 'manqueSection' : comptoir === null ? 'manquePrix' : null;

  function continuer() {
    if (manque) { toast(t(`carteAjout.${manque}`), 'erreur'); return; }
    setEtape('honneur');
  }
  async function declarer() {
    setEnvoi(true);
    try {
      let r;
      if (plat) {
        r = await api(`/restaurants/${restoId}/menu/${plat.id}/declare-price`, { method: 'POST', token, body: { counterPrice: comptoir, confirmed: true } });
      } else {
        r = await api(`/restaurants/${restoId}/menu/declare`, { method: 'POST', token, body: { name: nomPlat, desc: desc.trim(), category: section.trim(), counterPrice: comptoir, confirmed: true } });
        // La photo part après le plat : un plat déclaré sans sa photo reste un plat en ligne, la photo se remet du carré.
        if (photo) await apiUpload(`/restaurants/${restoId}/menu/${r.id}/photo`, { file: photo, token }).catch((e) => toast(e.message, 'erreur'));
      }
      vibrer('succes');
      setFait(r);
      setEtape('fait');
      onFait?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }

  const titre = plat ? t('carteAjout.changerPrixTitre') : t('carteAjout.nouveauPlat');
  const calcul = affiche === null ? null
    : regle.pourcent > 0 ? t('carteAjout.calculHausse', { prix: euros(affiche), p: regle.pourcent })
      : `${t('carteAjout.calculMeme', { prix: euros(affiche) })}${regle.badge ? ` ${t('carteAjout.calculBadge')}` : ''}`;

  const formulaire = (
    <div className="ec-ajout-form">
      {!plat && (
        <>
          <button type="button" className={`ec-ajout-photo${apercu ? ' pleine' : ''}`} onClick={() => champPhoto.current?.click()}>
            {apercu ? <img src={apercu} alt="" /> : <><Icone nom="photo" taille={28} />{t('carteAjout.photoAjouter')}</>}
          </button>
          <input ref={champPhoto} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (f) { setPhoto(f); setApercu(URL.createObjectURL(f)); }
          }} />
          <label className="ec-ajout-etiquette" htmlFor="ajout-nom">{t('carteAjout.nom')}</label>
          <input id="ajout-nom" value={nom} maxLength={120} placeholder={t('carteAjout.nomExemple')} onChange={(e) => setNom(e.target.value)} />
          <label className="ec-ajout-etiquette" htmlFor="ajout-desc">{t('carteAjout.description')}</label>
          <input id="ajout-desc" value={desc} maxLength={600} onChange={(e) => setDesc(e.target.value)} />
          <span className="ec-ajout-etiquette">{t('carteAjout.section')}</span>
          <div className="ec-ajout-pastilles" role="radiogroup" aria-label={t('carteAjout.section')}>
            {sections.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={!nouvelle && section === s} className={!nouvelle && section === s ? 'on' : ''}
                onClick={() => { setNouvelle(false); setSection(s); }}>{categoryLabel(s, t)}</button>
            ))}
            <button type="button" role="radio" aria-checked={nouvelle} className={nouvelle ? 'on' : ''}
              onClick={() => { setNouvelle(true); setSection(''); }}>{t('carteAjout.sectionNouvelle')}</button>
          </div>
          {nouvelle && <input aria-label={t('carteAjout.sectionNom')} placeholder={t('carteAjout.sectionNom')} value={section} maxLength={80} autoFocus onChange={(e) => setSection(e.target.value)} />}
        </>
      )}
      {plat && <p className="ec-ajout-sous">{t('carteAjout.prixActuel', { prix: euros(plat.price) })}</p>}
      <label className="ec-ajout-etiquette" htmlFor="ajout-prix">{t('carteAjout.prixComptoir')}</label>
      <div className="ec-ajout-prix">
        <input id="ajout-prix" inputMode="decimal" value={prix} placeholder="0,00" autoFocus={!!plat}
          onChange={(e) => setPrix(e.target.value.replace(/[^\d.,]/g, '').slice(0, 8))} onKeyDown={(e) => { if (e.key === 'Enter') continuer(); }} />
        <span aria-hidden="true">€</span>
      </div>
      {calcul && <p className="ec-ajout-calcul" aria-live="polite">{calcul}</p>}
      {!large && <button type="button" className="ec-bouton ec-bouton--lime" onClick={continuer}>{t('carteAjout.continuer')}</button>}
    </div>
  );

  const honneur = (
    <div className="ec-honneur">
      <h2 className="ec-ajout-titre">{t('carteAjout.honneurTitre')}</h2>
      <div className="ec-honneur-prix"><span>{nomPlat}</span><b>{comptoir !== null ? euros(comptoir) : ''}</b></div>
      <p className="ec-honneur-sous">
        {regle.pourcent > 0 ? t('carteAjout.honneurHausse', { prix: euros(affiche ?? 0), p: regle.pourcent }) : regle.badge ? t('carteAjout.honneurBadge') : t('carteAjout.honneurMeme')}
      </p>
      <ul className="ec-honneur-regles">
        {regle.badge && regle.pourcent === 0 && <li className="grave"><Icone nom="alerte" taille={20} />{t('carteAjout.regleBadge')}</li>}
        <li><Icone nom="document" taille={20} />{t('carteAjout.regleGardee')}</li>
      </ul>
      <button type="button" className="ec-bouton ec-bouton--lime" disabled={envoi} onClick={declarer}>
        <span>{envoi ? '…' : t('carteAjout.oui', { prix: euros(comptoir ?? 0) })}</span>
      </button>
      {!large && <button type="button" className="ec-bouton ec-bouton--texte ec-honneur-retour" onClick={() => setEtape('form')}>{t('carteAjout.corriger')}</button>}
    </div>
  );

  const quand = fait?.declaration ? new Date(fait.declaration.declaredAt).toLocaleString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const tampon = fait && (
    <div className="ec-honneur ec-honneur--fait">
      <h2 className="ec-ajout-titre">{t('carteAjout.faitTitre')}</h2>
      <div className="ec-tampon">
        <small>{t('carteAjout.faitSurHonneur')}</small>
        <b>{t('carteAjout.faitLigne', { plat: nomPlat, prix: euros(fait.declaration?.counterPrice ?? comptoir) })}</b>
        <span>{t('carteAjout.faitQui', { nom: fait.declaration?.declaredName || '', date: quand })}</span>
      </div>
      <p className="ec-honneur-sous">{plat ? t('carteAjout.faitPrix', { prix: euros(fait.price) }) : t('carteAjout.faitEnLigne', { prix: euros(fait.price) })}</p>
      {fait.carteASigner && <p className="ec-honneur-sous">{t('carteAjout.faitASigner')}</p>}
      <button type="button" className="ec-bouton ec-bouton--lime" onClick={onFermer}>{t('carteAjout.retour')}</button>
    </div>
  );

  return (
    <Modale ariaLabel={titre} onFermer={onFermer} classeBoite={`ec-ajout${large && etape !== 'fait' ? ' ec-ajout--deux' : ''}${etape !== 'form' && !large ? ' ec-ajout--iris' : ''}`}>
      {etape === 'fait' ? tampon : (
        <>
          <div className="ec-ajout-haut">
            <b>{etape === 'form' || large ? (plat ? t('carteAjout.changerPrix', { name: plat.name }) : titre) : ''}</b>
            <button type="button" className="ec-ajout-fermer" onClick={onFermer} aria-label={t('carteAjout.fermer')}><Icone nom="croix" taille={16} /></button>
          </div>
          {large ? (
            <div className="ec-ajout-moities">
              {formulaire}
              <div className="ec-ajout-droite">{manque ? <p className="ec-ajout-attente">{t('carteAjout.siteAttente')}</p> : honneur}</div>
            </div>
          ) : etape === 'form' ? formulaire : honneur}
        </>
      )}
    </Modale>
  );
}
