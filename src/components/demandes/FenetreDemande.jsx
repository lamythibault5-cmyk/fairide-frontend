import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import useDialogue from '../../hooks/useDialogue';
import useTirerPourFermer from '../../hooks/useTirerPourFermer';
import { COMMUNES } from '../../menuCategories';
import { vibrer } from '../../gestes';
import Icone from '../Icone';
import {
  chercher, demander, dessinDemande, sousTitreDemande, rangEcrit, telephoneAVerifier, CHEMIN_VERIFIER_TELEPHONE
} from '../../demandes';

/* LA FENÊTRE « LEQUEL ? » (« Demande ton restaurant », fondateur, 2026-10-26 ; réponses 4, 5 et 8 du questionnaire de
 * maquettes/demande-restaurant). On choisit le restaurant dans une LISTE, pas en texte libre : « chez leon », « Chez Léon » et
 * « Léon » ne font ainsi qu'une demande. En tête, les restaurants déjà demandés qui portent ce nom (on rejoint leur demande),
 * puis les fiches OpenStreetMap autour du client. Un commerce déjà commandable sur Fairride renvoie à sa fiche ; « Il n'est
 * pas dans la liste » ouvre le nom et la commune à la main. Puis « Ce que tu y prends » (facultatif), « Me prévenir quand
 * il arrive » (allumé : c'est ce qu'il a demandé, un seul message), et le bouton lime « Demander <nom> ».
 *
 * Même cadre que ConfirmDialog : feuille du bas dans l'app (on la tire pour fermer), fenêtre centrée sur le site.
 * Le bouton lime n'est jamais grisé (design.md, règle 4) : sans restaurant choisi, il ramène au champ de recherche. */
export default function FenetreDemande({ requete, onFermer, onDemande }) {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const racine = useRef(null);
  const champ = useRef(null);
  const [q, setQ] = useState(requete || '');
  const [res, setRes] = useState(null); // { deja, fiches }
  const [chargement, setChargement] = useState(false);
  const [echec, setEchec] = useState(false);
  const [choix, setChoix] = useState(null); // { cle, nom, lieu }
  const [manuel, setManuel] = useState(false);
  const [nom, setNom] = useState('');
  const [commune, setCommune] = useState('');
  const [plat, setPlat] = useState('');
  const [prevenir, setPrevenir] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [telephone, setTelephone] = useState(false);
  const [fait, setFait] = useState(null); // { nom, rang, prevenir }
  useDialogue(racine, onFermer);
  const tirer = useTirerPourFermer(racine, envoi ? null : onFermer);

  // La recherche part 350 ms après la dernière lettre : une requête par mot, pas par touche.
  useEffect(() => {
    if (manuel) return undefined;
    const terme = q.trim();
    if (terme.length < 3) { setRes(null); setEchec(false); return undefined; }
    let annule = false;
    setChargement(true); setEchec(false);
    const id = setTimeout(() => {
      chercher(terme, user, token)
        .then((r) => { if (!annule) setRes(r); })
        .catch(() => { if (!annule) { setRes(null); setEchec(true); } })
        .finally(() => { if (!annule) setChargement(false); });
    }, 350);
    return () => { annule = true; clearTimeout(id); };
  }, [q, manuel, user, token]);

  const choisir = (c) => { vibrer('bascule'); setChoix((avant) => (avant?.cle === c.cle ? null : c)); setErreur(''); };
  const lieuFiche = (f) => (f.demandeId ? { demandeId: f.demandeId }
    : f.commerce ? { restaurantId: f.commerce.id }
      : { osmType: f.osmType, osmId: f.osmId, nom: f.nom, rue: f.rue, numero: f.numero, codePostal: f.codePostal, commune: f.commune, lat: f.lat, lng: f.lng, osmCategorie: f.categorie });

  const nomChoisi = manuel ? nom.trim() : choix?.nom;
  async function envoyer() {
    if (!manuel && !choix) { champ.current?.focus(); return; }
    if (manuel && nom.trim().length < 2) { setErreur(t('demandes.nom')); document.getElementById('dm-nom')?.focus(); return; }
    if (manuel && !commune) { setErreur(t('demandes.communeChoisir')); document.getElementById('dm-commune')?.focus(); return; }
    setEnvoi(true); setErreur('');
    try {
      const lieu = manuel ? { nom: nom.trim(), commune } : choix.lieu;
      const r = await demander({ lieu, plat: plat.trim(), prevenir }, token);
      vibrer('valider');
      setFait({ nom: r.demande?.nom || nomChoisi, rang: r.rang || 1, prevenir });
      onDemande?.(r);
    } catch (e) {
      if (telephoneAVerifier(e)) setTelephone(true);
      else setErreur(e.message);
    } finally { setEnvoi(false); }
  }

  const ligneDemande = (d) => {
    const cle = `d:${d.id}`;
    const dessin = dessinDemande(d);
    const on = choix?.cle === cle;
    return (
      <button key={cle} type="button" className={`dm-choix${on ? ' on' : ''}`} aria-pressed={on}
        onClick={() => choisir({ cle, nom: d.nom, lieu: { demandeId: d.id } })}>
        <span className="dm-choix-tuile" aria-hidden="true">{dessin ? <img src={dessin} alt="" width="26" height="26" /> : <Icone nom="restaurants" taille={18} />}</span>
        <span className="dm-choix-texte">
          <b>{d.nom}</b>
          <small>{[sousTitreDemande(d, t), t('demandes.nDemandes', { n: d.total })].filter(Boolean).join(' · ')}</small>
        </span>
        <span className="dm-coche" aria-hidden="true">{on && <Icone nom="coche" taille={14} />}</span>
      </button>
    );
  };
  const ligneFiche = (f) => {
    const cle = f.demandeId ? `d:${f.demandeId}` : f.commerce ? `r:${f.commerce.id}` : `o:${f.osmType}:${f.osmId}`;
    const adresse = [[f.rue, f.numero].filter(Boolean).join(' '), [f.codePostal, f.commune].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const dessin = dessinDemande({ osmCategorie: f.categorie });
    // Déjà commandable : rien à demander, on ouvre sa fiche.
    if (f.commerce?.commandable) {
      return (
        <Link key={cle} className="dm-choix dm-choix--fairride" to={`/restaurants/${f.commerce.slug || f.commerce.id}`} onClick={onFermer}>
          <span className="dm-choix-tuile" aria-hidden="true"><Icone nom="coche" taille={18} /></span>
          <span className="dm-choix-texte"><b>{f.nom}</b><small>{t('demandes.dejaSurFairride')}</small></span>
          <span className="dm-choix-lien">{t('demandes.voirSaCarte')}</span>
        </Link>
      );
    }
    const on = choix?.cle === cle;
    return (
      <button key={cle} type="button" className={`dm-choix${on ? ' on' : ''}`} aria-pressed={on}
        onClick={() => choisir({ cle, nom: f.nom, lieu: lieuFiche(f) })}>
        <span className="dm-choix-tuile" aria-hidden="true">{dessin ? <img src={dessin} alt="" width="26" height="26" /> : <Icone nom="restaurants" taille={18} />}</span>
        <span className="dm-choix-texte">
          <b>{f.nom}</b>
          <small>{f.commerce ? t('demandes.carteSeule') : [adresse, f.total ? t('demandes.nDemandes', { n: f.total }) : null].filter(Boolean).join(' · ')}</small>
        </span>
        <span className="dm-coche" aria-hidden="true">{on && <Icone nom="coche" taille={14} />}</span>
      </button>
    );
  };

  let corps;
  if (fait) {
    corps = (
      <div className="dm-ok">
        <span className="dm-ok-rond" aria-hidden="true"><Icone nom="coche" taille={40} /></span>
        <h3 className="modal-titre" id="dm-titre">{t('demandes.okTitre')}</h3>
        <p>{fait.rang <= 1 ? t('demandes.okPremier', { nom: fait.nom }) : t('demandes.okRang', { rang: rangEcrit(fait.rang, language), nom: fait.nom })}</p>
        <p>{fait.prevenir ? t('demandes.okTexte') : t('demandes.okTexteSansPrevenir')}</p>
        <span className="dm-ok-compteur"><Icone nom="megaphone" taille={16} />{t('demandes.nDemandes', { n: fait.rang })}</span>
        <div className="modal-pied"><button type="button" className="btn-outline" onClick={onFermer}>{t('common.close')}</button></div>
      </div>
    );
  } else if (telephone) {
    corps = (
      <>
        <span className="confirm-icone" aria-hidden="true"><Icone nom="telephone" taille={22} /></span>
        <h3 className="modal-titre" id="dm-titre">{t('demandes.telTitre')}</h3>
        <p className="small" style={{ margin: '0 0 4px' }}>{t('demandes.telTexte')}</p>
        <div className="modal-pied">
          <button type="button" className="btn-gold" onClick={() => { onFermer(); navigate(CHEMIN_VERIFIER_TELEPHONE); }}>{t('demandes.telBouton')}</button>
          <button type="button" className="btn-ghost" onClick={onFermer}>{t('common.cancel')}</button>
        </div>
      </>
    );
  } else {
    const terme = q.trim();
    const rien = res && !res.deja.length && !res.fiches.length;
    corps = (
      <>
        <h3 className="modal-titre" id="dm-titre">{t('demandes.fenetreTitre')}</h3>
        {!manuel && (
          <>
            <p className="small" style={{ margin: '0 0 10px' }}>{t('demandes.fenetreSous')}</p>
            <div className="recherche-champ dm-champ" role="search">
              <span className="recherche-loupe" aria-hidden="true"><Icone nom="recherche" taille={20} /></span>
              <input ref={champ} type="search" value={q} onChange={(e) => { setQ(e.target.value); setChoix(null); }}
                placeholder={t('demandes.champRecherche')} aria-label={t('demandes.champRecherche')} autoComplete="off" enterKeyHint="search" />
            </div>
            <div className="dm-resultats" aria-live="polite">
              {terme.length > 0 && terme.length < 3 && <p className="small">{t('demandes.tapeTrois')}</p>}
              {chargement && <p className="small">{t('demandes.recherche')}</p>}
              {!chargement && echec && <p className="small">{t('demandes.rechercheEchec')}</p>}
              {!chargement && rien && <p className="small">{t('demandes.aucunResultat', { q: terme })}</p>}
              {!chargement && res?.deja?.length > 0 && <><h4 className="dm-groupe">{t('demandes.dejaDemandes')}</h4>{res.deja.map(ligneDemande)}</>}
              {!chargement && res?.fiches?.length > 0 && <><h4 className="dm-groupe">{t('demandes.trouves')}</h4>{res.fiches.map(ligneFiche)}</>}
            </div>
            <button type="button" className="dm-lien" onClick={() => { setManuel(true); setNom(q.trim()); setChoix(null); }}>{t('demandes.pasDansLaListe')}</button>
          </>
        )}
        {manuel && (
          <>
            <div className="field">
              <label htmlFor="dm-nom">{t('demandes.nom')}</label>
              <input id="dm-nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="dm-commune">{t('demandes.commune')}</label>
              <select id="dm-commune" value={commune} onChange={(e) => setCommune(e.target.value)}>
                <option value="">{t('demandes.communeChoisir')}</option>
                {COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" className="dm-lien" onClick={() => setManuel(false)}>{t('demandes.revenirListe')}</button>
          </>
        )}
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="dm-plat">{t('demandes.plat')}</label>
          <input id="dm-plat" value={plat} onChange={(e) => setPlat(e.target.value)} maxLength={80} placeholder={t('demandes.platExemple')} autoComplete="off" />
        </div>
        <button type="button" role="switch" aria-checked={prevenir} className="dm-prevenir" onClick={() => { vibrer('bascule'); setPrevenir((p) => !p); }}>
          <span className="dm-prevenir-texte"><b>{t('demandes.prevenir')}</b><small>{t('demandes.prevenirSous')}</small></span>
          <span className={`co-interrupteur${prevenir ? ' on' : ''}`} aria-hidden="true" />
        </button>
        {erreur && <p className="dm-erreur" role="alert">{erreur}</p>}
        <div className="modal-pied">
          <button type="button" className="btn-gold" onClick={envoyer} disabled={envoi}>
            {envoi ? '...' : nomChoisi ? t('demandes.demanderNom', { nom: nomChoisi }) : t('demandes.demanderCeRestaurant')}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="modal-overlay confirm-voile" onClick={envoi ? undefined : onFermer}>
      <div {...tirer} className="modal-box confirm-feuille dm-fenetre" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="dm-titre" ref={racine} tabIndex={-1}>
        <span className="confirm-poignee" aria-hidden="true" />
        {corps}
      </div>
    </div>
  );
}
