import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';
import useFenetreDemande from './useFenetreDemande';
import useMoiAussi from './useMoiAussi';
import { dessinDemande } from '../../demandes';
import '../../ecran-demandes.css';

/* LES DEUX PORTES VERS « LEQUEL ? » (fondateur, 2026-10-26, version B, réponse 2 du questionnaire).
 *
 * Recherche sans résultat : c'est là que le client a le plus envie de demander — il vient de taper le nom. La carte lui
 * propose de le demander, avec le mot tapé déjà dans la fenêtre. Seule action de l'écran : le bouton est lime.
 *
 * Fin de la liste des restaurants (« Il manque ton restaurant ? ») : après « À découvrir », là où l'on se dit qu'il manque
 * le sien. Écran de navigation, sans lime (design.md, règle 4 : un écran qui se parcourt n'a pas de lime) — bouton en contour. */
export function CarteDemanderRecherche({ requete }) {
  const { t } = useLanguage();
  const { ouvrir, fenetre } = useFenetreDemande();
  return (
    <div className="dm-carte dm-carte--recherche">
      <div className="dm-carte-tete">
        <span className="dm-carte-rond" aria-hidden="true"><Icone nom="commerce" taille={22} /></span>
        <div>
          <h3>{t('demandes.rechercheTitre')}</h3>
          <p>{t('demandes.rechercheTexte')}</p>
        </div>
      </div>
      <button type="button" className="btn-gold dm-carte-bouton" onClick={() => ouvrir(requete)}>{t('demandes.demanderCeRestaurant')}</button>
      {fenetre}
    </div>
  );
}

// `onOuvrir` : la fenêtre unique de l'accueil (accueil plein, 2026-11-12) ; sans lui, la carte ouvre la sienne.
export function FinDeListeDemande({ onOuvrir = null }) {
  const { t } = useLanguage();
  const propre = useFenetreDemande();
  const ouvrir = onOuvrir || propre.ouvrir;
  return (
    <div className="dm-carte dm-carte--fin">
      <span className="dm-carte-rond" aria-hidden="true"><Icone nom="commerce" taille={22} /></span>
      <h3>{t('demandes.finTitre')}</h3>
      <p>{t('demandes.finTexte')}</p>
      <button type="button" className="btn-outline dm-carte-bouton" onClick={() => ouvrir('')}>
        <Icone nom="demande" taille={18} />{t('demandes.finBouton')}
      </button>
      {!onOuvrir && propre.fenetre}
    </div>
  );
}

/* « IL EN MANQUE UN ? » AU BOUT D'UNE RANGÉE PAR ENVIE (fondateur, 2026-11-12, maquettes/accueil-plein section 5, réponse 9) :
 * on a glissé toutes les pizzerias sans trouver la sienne, la tuile est là ; la page « Demandés près de toi » s'ouvre sur la
 * catégorie de la rangée, le champ prêt. Écran de navigation : pas de lime (design.md, règle 4), un filet pointillé comme
 * « Le tien ? ». Sur le site en grille (ordinateur), la tuile ferait une ligne de plus : un lien à droite du titre à la place. */
export function TuileIlEnManque({ categorie, dessin, onOuvrir }) {
  const { t } = useLanguage();
  return (
    <button type="button" className="dm-manque" onClick={() => onOuvrir('', { categorie })}>
      {dessin && <img src={dessin} alt="" width="44" height="44" decoding="async" draggable="false" />}
      <b>{t('demandes.manqueTitre')}</b>
      <small>{t('demandes.autreBouton')}</small>
    </button>
  );
}
export function LienIlEnManque({ categorie, onOuvrir }) {
  const { t } = useLanguage();
  return (
    <button type="button" className="dm-manque-lien" onClick={() => onOuvrir('', { categorie })}>
      <Icone nom="demande" taille={16} />{t('demandes.manqueTitre')}
    </button>
  );
}

/* LE RAPPEL AU MILIEU DE « TOUS LES COMMERCES » (même questionnaire, réponse 9) : après le 10e commerce, le restaurant le plus
 * demandé près de toi (le premier que le client n'a pas encore demandé), « Moi aussi » en un toucher et « Voir les N ». Un seul,
 * jamais deux : une pause dans la liste, pas une publicité. Rien autour : rien. `demandes` : useDemandesPres de l'accueil. */
export function RappelDemande({ demandes, onOuvrir }) {
  const { t } = useLanguage();
  const { basculer, dialogue, occupe } = useMoiAussi();
  const d = demandes.liste.find((x) => !x.moi) || demandes.liste[0];
  if (!d) return null;
  const dessin = dessinDemande(d);
  return (
    <div className="dm-rappel">
      {dessin ? <img src={dessin} alt="" width="44" height="44" decoding="async" draggable="false" /> : <span className="dm-ticket-icone" aria-hidden="true"><Icone nom="restaurants" taille={18} /></span>}
      <span className="dm-rappel-haut">{[t('demandes.rappelHaut'), d.commune].filter(Boolean).join(' · ')}</span>
      <span className="dm-rappel-nom">{t(d.total === 1 ? 'demandes.rappelNomUn' : 'demandes.rappelNom', { nom: d.nom, n: d.total })}</span>
      <span className="dm-rappel-bas">
        <button type="button" className={`dm-moi-aussi${d.moi ? ' on' : ''}`} aria-pressed={!!d.moi} disabled={occupe(d.id)} onClick={() => basculer(d, null, demandes.maj)}>
          {d.moi ? <><Icone nom="coche" taille={16} />{t('demandes.demande')}</> : t('demandes.moiAussi')}
        </button>
        <button type="button" className="dm-rappel-lien" onClick={() => onOuvrir('', { mode: 'voir' })}>
          {t('demandes.voirLes', { n: demandes.nombre || demandes.liste.length })}<Icone nom="fleche" taille={16} />
        </button>
      </span>
      {dialogue}
    </div>
  );
}
