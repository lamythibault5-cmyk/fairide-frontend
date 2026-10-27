import Icone from '../Icone';
import { dessinDemande, sousTitreDemande } from '../../demandes';

/* LA CARTE « TICKET » D'UN RESTAURANT DEMANDÉ (fondateur, 2026-10-26 : look 5 de maquettes/demande-restaurant/card-look-en.html).
 * Pas de photo : celle du restaurant ne nous appartient pas tant qu'il n'est pas sur Fairride (une photo prise sur son site
 * ou ailleurs poserait un problème de droits et laisserait croire qu'il est déjà partenaire). Une carte iris qui se lit
 * comme une DEMANDE, pas comme un restaurant dont la photo n'a pas chargé : le dessin plat de sa cuisine, son nom, le
 * nombre en lime (lime sur iris), dix traits vers l'objectif (25), et « Moi aussi ».
 *
 * « Moi aussi » (réponse 1b) : dans l'app, verre BLANC avant (le verre clair sans sa teinte iris, « moins bleu »), verre
 * traversant avec la coche lime une fois demandé — verre.css. Sur le site, pas de verre : un bouton blanc plein. */
export default function TicketDemande({ d, onMoiAussi, occupe = false, t }) {
  const dessin = dessinDemande(d);
  const objectif = d.objectif || 25;
  const pleins = Math.round(Math.min(1, (d.total || 0) / objectif) * 10);
  return (
    <article className="dm-ticket" aria-label={d.nom}>
      <div className="dm-ticket-haut">
        {dessin
          ? <img src={dessin} alt="" width="30" height="30" decoding="async" draggable="false" />
          : <span className="dm-ticket-icone" aria-hidden="true"><Icone nom="restaurants" taille={16} /></span>}
        <span>{sousTitreDemande(d, t)}</span>
      </div>
      <h3 className="dm-ticket-nom">{d.nom}</h3>
      <div className="dm-ticket-nb">
        {d.total || 0}
        <small>{(d.total || 0) === 1 ? t('demandes.veutUn') : t('demandes.veulent')}</small>
      </div>
      <div className="dm-ticket-points" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < pleins ? 'on' : undefined} />)}
      </div>
      <button type="button" className={`dm-moi-aussi${d.moi ? ' on' : ''}`} aria-pressed={!!d.moi} disabled={occupe} onClick={() => onMoiAussi(d)}>
        {d.moi ? <><Icone nom="coche" taille={16} />{t('demandes.demande')}</> : t('demandes.moiAussi')}
      </button>
    </article>
  );
}
