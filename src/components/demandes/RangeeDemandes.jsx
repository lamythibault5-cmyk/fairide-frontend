import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';
import TicketDemande from './TicketDemande';
import useMoiAussi from './useMoiAussi';
import '../../ecran-demandes.css';

/* LA RANGÉE « DEMANDÉS PRÈS DE TOI » (fondateur, 2026-10-26, version B de maquettes/demande-restaurant), sous « Autour de
 * toi » : les restaurants que des clients demandent, pas encore sur Fairride, à moins de 10 km de l'adresse du compte, le
 * plus demandé d'abord. Une carte « ticket » par restaurant (TicketDemande.jsx), « Moi aussi » en un toucher.
 *
 * TOUJOURS LÀ, ET LA DEMANDE EN PREMIER (fondateur, 2026-11-12, maquettes/accueil-plein section 5, réponse 8) : avec « Tous les
 * commerces » en bas, la carte de fin « Il manque ton restaurant ? » tombait à 12,6 écrans du haut (35 à 100 commerces).
 *   - « Le tien ? » est la PREMIÈRE carte (on demande sans glisser ; avant, « Un autre ? » était la dernière) ;
 *   - puis les PAR_RANGEE_DEMANDES plus demandés, puis « Voir les N » quand il y en a plus ;
 *   - le titre se touche (comme les rangées par envie) et ouvre la page « Demandés près de toi » (FenetreDemande, mode 'voir') ;
 *   - aucune demande autour : une ligne fine « Il manque ton restaurant ? », pas une rangée vide.
 * Les données viennent de l'accueil (useDemandesPres), partagées avec le rappel au milieu de « Tous ». `ouvrir(texte, options)`
 * : la fenêtre unique de l'accueil (useFenetreDemande). `grand` : la grille du site sur ordinateur, comme les rangées voisines. */
export default function RangeeDemandes({ grand = false, demandes, ouvrir }) {
  const { t } = useLanguage();
  const { basculer, dialogue, occupe } = useMoiAussi();
  const { liste, nombre, maj } = demandes;

  if (!liste.length) {
    return (
      <section className="liste-section dm-section" aria-labelledby="dm-rangee-titre">
        <h2 className="section-title section-titre-icone dm-rangee-titre" id="dm-rangee-titre" style={{ fontSize: 17, margin: '0 0 10px' }}>
          <Icone nom="demande" taille={18} />{t('demandes.rangeeTitre')}
        </h2>
        <div className="dm-fine">
          <span className="dm-autre-rond" aria-hidden="true"><Icone nom="demande" taille={20} /></span>
          <span className="dm-fine-texte"><b>{t('demandes.finTitre')}</b><small>{t('demandes.fineSous')}</small></span>
          <button type="button" className="dm-moi-aussi dm-moi-aussi--clair" onClick={() => ouvrir('')}>{t('demandes.autreBouton')}</button>
        </div>
        {dialogue}
      </section>
    );
  }
  const voir = () => ouvrir('', { mode: 'voir' });
  return (
    <section className="liste-section dm-section" aria-labelledby="dm-rangee-titre">
      <h2 className="section-title section-titre-icone dm-rangee-titre" id="dm-rangee-titre" style={{ fontSize: 17, margin: '0 0 2px' }}>
        <button type="button" className="section-titre-bouton" onClick={voir} aria-label={t('restaurantList.voirTout', { nom: t('demandes.rangeeTitre') })}>
          <Icone nom="demande" taille={18} /><span>{t('demandes.rangeeTitre')}</span>
          <span className="section-vers" aria-hidden="true"><Icone nom="fleche" taille={16} /></span>
        </button>
      </h2>
      <p className="small dm-rangee-sous">{t('demandes.rangeeSous')}</p>
      <div className={grand ? 'rest-grid sl-grille sl-une-ligne dm-grille' : 'rest-grid rest-grid-scroll dm-rangee'}>
        <div className="dm-ticket dm-ticket--autre">
          <span className="dm-autre-rond" aria-hidden="true"><Icone nom="demande" taille={22} /></span>
          <b>{t('demandes.tienTitre')}</b>
          <small>{t('demandes.tienSous')}</small>
          <button type="button" className="dm-moi-aussi dm-moi-aussi--clair" onClick={() => ouvrir('')}>{t('demandes.autreBouton')}</button>
        </div>
        {liste.map((d) => (
          <TicketDemande key={d.id} d={d} t={t} occupe={occupe(d.id)} onMoiAussi={(x) => basculer(x, null, maj)} />
        ))}
        {nombre > liste.length && (
          <button type="button" className="dm-ticket dm-ticket--voir" onClick={voir}>
            <b>{nombre}</b>
            <span>{t('demandes.voirTout')}</span>
            <Icone nom="fleche" taille={18} />
          </button>
        )}
      </div>
      {dialogue}
    </section>
  );
}
