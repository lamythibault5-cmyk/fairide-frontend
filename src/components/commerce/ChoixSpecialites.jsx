import { useId, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { experienceApp } from '../../natif';
import { illustrationCuisine, restaurantTypeLabel } from '../../menuCategories';
import { FAMILLES, MAX_SPECIALITES, SPECIALITES, chercherSpecialites, libelleFamille, specialite } from '../../specialites';
import Icone from '../Icone';
import '../../choix-specialites.css';

/* CE QUE LE COMMERCE VEND (fondateur, 2026-10-22, version A de maquettes/categories-commerce/categories-commerce.html).
 *
 * Un seul écran partout : l'inscription dans l'app (InscriptionAppli.jsx) et sur le site (Auth.jsx), la création d'un
 * commerce depuis le tableau de bord (CreationCommerce.jsx) et Mon commerce › Type (EcranTypeCommerce.jsx) — le commerce
 * change ses choix quand il veut, de la même manière (fondateur, même jour).
 *
 *   - en haut, une recherche qui comprend les mots de tous les jours (« congo », « pho », « fritkot » : specialites.js) ;
 *   - sans recherche, les 19 familles en tuiles (le dessin de la cuisine sur son fond pastel, comme « Par envie ») ; une
 *     tuile ouvre ses spécialités ;
 *   - jusqu'à 7 choix, dans l'ordre : le premier s'affiche sur la fiche (restaurants.cuisine), les autres servent aux
 *     filtres (extra_cuisines). Toucher un autre choix le met en premier ;
 *   - « Je ne trouve pas » : un texte libre, comme « Autre » avant (réponse 4 du questionnaire). Il n'a pas de famille,
 *     donc il n'apparaît dans aucun filtre : la recherche par nom le trouve quand même.
 *
 * `valeurs` : les valeurs françaises enregistrées (une saisie libre telle quelle). `boite` : dans un écran plein de l'app,
 * les choix tiennent sur une ligne qui défile de côté et seul le corps défile, pour que le bouton reste à l'écran. */
export default function ChoixSpecialites({ valeurs, onChange, erreur = null, boite = false, max = MAX_SPECIALITES }) {
  const { t } = useLanguage();
  const app = experienceApp();
  const id = useId();
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState(null);
  const [libreOuvert, setLibreOuvert] = useState(false);
  const [libre, setLibre] = useState('');
  const plein = valeurs.length >= max;
  const egal = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const choisie = (v) => valeurs.some((x) => egal(x, v));
  const libelle = (v) => restaurantTypeLabel(v, t) || v;
  const illustration = (nom) => illustrationCuisine(nom, { plat: !app });

  function basculer(v) {
    if (choisie(v)) onChange(valeurs.filter((x) => !egal(x, v)));
    else if (!plein) onChange([...valeurs, v]);
  }
  // Pas de <form> : l'écran est parfois DANS le formulaire d'inscription du site (Auth.jsx), et un formulaire imbriqué
  // enverrait l'inscription. Entrée dans le champ fait la même chose que le bouton.
  function ajouterLibre() {
    // 40 caractères : la limite du serveur pour un type en plus (cuisinesSecondaires) ; une valeur connue garde sa casse.
    const v = libre.trim().slice(0, 40);
    if (!v || plein) return;
    if (!choisie(v)) onChange([...valeurs, specialite(v)?.value || v]);
    setLibre(''); setLibreOuvert(false); setRecherche('');
  }

  const puce = (s) => {
    const on = choisie(s.value);
    return (
      <button key={s.value} type="button" className={`cs-puce${on ? ' on' : ''}`} aria-pressed={on} disabled={!on && plein} onClick={() => basculer(s.value)}>
        {libelle(s.value)}
      </button>
    );
  };

  let corps;
  const cherche = recherche.trim();
  if (cherche) {
    const trouvees = chercherSpecialites(cherche, t);
    corps = trouvees.length ? (
      <>
        <p className="cs-titre" aria-live="polite">{t('specialites.trouves', { n: trouvees.length })}</p>
        <div className="cs-puces">{trouvees.map(puce)}</div>
      </>
    ) : <p className="cs-rien" aria-live="polite">{t('specialites.rien', { q: cherche })}</p>;
  } else if (ouverte) {
    const f = FAMILLES.find((x) => x.cle === ouverte);
    corps = (
      <div className="cs-volet">
        <button type="button" className="cs-retour" onClick={() => setOuverte(null)}>
          <Icone nom="retour" taille={18} /><span>{t('specialites.toutesFamilles')}</span>
        </button>
        <h3 className="cs-volet-titre">
          <img src={illustration(f.illustration)} alt="" width="30" height="30" decoding="async" draggable="false" style={{ background: f.fond }} />
          {libelleFamille(f.cle, t)}
        </h3>
        <div className="cs-puces">{SPECIALITES.filter((s) => s.familles.includes(f.cle)).map(puce)}</div>
      </div>
    );
  } else {
    corps = (
      <>
        <p className="cs-titre">{t('specialites.choisisFamille')}</p>
        <div className="cs-tuiles">
          {FAMILLES.map((f) => {
            const n = valeurs.filter((v) => specialite(v)?.familles.includes(f.cle)).length;
            return (
              <button key={f.cle} type="button" className="cs-tuile" style={{ '--tuile-fond': f.fond }} onClick={() => setOuverte(f.cle)}>
                <img src={illustration(f.illustration)} alt="" width="42" height="42" decoding="async" draggable="false" />
                <span>{libelleFamille(f.cle, t)}</span>
                {n > 0 && <span className="cs-tuile-nb" aria-label={t('specialites.compte', { n, max })}>{n}</span>}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className={`cs${boite ? ' cs--boite' : ''}`} role="group" aria-label={t('specialites.groupe')}>
      <label htmlFor={`${id}-cherche`} className="sr-only">{t('specialites.chercher')}</label>
      <input id={`${id}-cherche`} type="search" className="cs-cherche" autoComplete="off" enterKeyHint="search" value={recherche}
        onChange={(e) => setRecherche(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} placeholder={t('specialites.chercher')} />
      {valeurs.length > 0 && (
        <div className="cs-choix">
          <p className="cs-choix-tete"><span>{t('specialites.tesChoix')}</span><span>{t('specialites.compte', { n: valeurs.length, max })}</span></p>
          <div className="cs-choisis">
            {valeurs.map((v, i) => (
              <span key={v} className="cs-choisi">
                {i === 0 ? <span className="cs-choisi-nom">{libelle(v)}<small>{t('specialites.surTaFiche')}</small></span>
                  : <button type="button" className="cs-choisi-nom" aria-label={t('specialites.mettrePremier', { nom: libelle(v) })}
                    onClick={() => onChange([v, ...valeurs.filter((x) => x !== v)])}>{libelle(v)}</button>}
                <button type="button" className="cs-retirer" aria-label={t('specialites.retirer', { nom: libelle(v) })} onClick={() => onChange(valeurs.filter((x) => x !== v))}>
                  <Icone nom="croix" taille={12} />
                </button>
              </span>
            ))}
          </div>
          {valeurs.length > 1 && <p className="cs-aide">{t('specialites.aideOrdre')}</p>}
        </div>
      )}
      {erreur && <p className="field-error" role="alert">{erreur}</p>}
      <div className="cs-corps">
        {corps}
        {plein && <p className="cs-aide">{t('specialites.plein', { max })}</p>}
        {!libreOuvert ? (
          <button type="button" className="cs-pas-trouve" disabled={plein} onClick={() => { setLibre(cherche); setLibreOuvert(true); }}>{t('specialites.pasTrouve')}</button>
        ) : (
          <div className="cs-libre">
            <label htmlFor={`${id}-libre`}>{t('specialites.libreLabel')}</label>
            <div className="cs-libre-ligne">
              <input id={`${id}-libre`} value={libre} maxLength={40} autoFocus onChange={(e) => setLibre(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterLibre(); } }} placeholder={t('specialites.librePh')} />
              <button type="button" className="cs-ajouter" disabled={!libre.trim()} onClick={ajouterLibre}>{t('specialites.ajouter')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
