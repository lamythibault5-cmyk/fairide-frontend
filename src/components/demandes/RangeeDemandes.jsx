import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';
import TicketDemande from './TicketDemande';
import useMoiAussi from './useMoiAussi';
import useFenetreDemande from './useFenetreDemande';
import { chargerPres } from '../../demandes';
import '../../ecran-demandes.css';

/* LA RANGÉE « DEMANDÉS PRÈS DE TOI » (fondateur, 2026-10-26, version B de maquettes/demande-restaurant), sous « Autour de
 * toi » : les restaurants que des clients demandent, pas encore sur Fairride, à moins de 10 km de l'adresse du compte, le
 * plus demandé d'abord. Une carte « ticket » par restaurant (TicketDemande.jsx), « Moi aussi » en un toucher, et à la fin
 * « Un autre ? » qui ouvre la fenêtre « Lequel ? ». Rien à montrer : la rangée ne s'affiche pas (la carte de fin de liste,
 * FinDeListeDemande, reste là pour demander). `grand` : la grille du site sur ordinateur, comme les rangées voisines. */
export default function RangeeDemandes({ grand = false }) {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [liste, setListe] = useState([]);
  const { basculer, dialogue, occupe } = useMoiAussi();
  const charger = useCallback(() => chargerPres(user, token).then((r) => setListe(r.demandes || [])).catch(() => {}), [user, token]);
  const { ouvrir, fenetre } = useFenetreDemande(charger);
  useEffect(() => { charger(); }, [charger]);

  if (!liste.length) return null;
  const maj = (suivant) => setListe((l) => l.map((x) => (x.id === suivant.id ? { ...x, ...suivant } : x)));
  return (
    <section className="liste-section dm-section" aria-labelledby="dm-rangee-titre">
      <h2 className="section-title section-titre-icone dm-rangee-titre" id="dm-rangee-titre" style={{ fontSize: 17, margin: '0 0 2px' }}>
        <Icone nom="demande" taille={18} />{t('demandes.rangeeTitre')}
      </h2>
      <p className="small dm-rangee-sous">{t('demandes.rangeeSous')}</p>
      <div className={grand ? 'rest-grid sl-grille dm-grille' : 'rest-grid rest-grid-scroll dm-rangee'}>
        {liste.map((d) => (
          <TicketDemande key={d.id} d={d} t={t} occupe={occupe(d.id)} onMoiAussi={(x) => basculer(x, null, maj)} />
        ))}
        <div className="dm-ticket dm-ticket--autre">
          <span className="dm-autre-rond" aria-hidden="true"><Icone nom="demande" taille={22} /></span>
          <b>{t('demandes.autreTitre')}</b>
          <small>{t('demandes.autreSous')}</small>
          <button type="button" className="dm-moi-aussi dm-moi-aussi--clair" onClick={() => ouvrir('')}>{t('demandes.autreBouton')}</button>
        </div>
      </div>
      {fenetre}
      {dialogue}
    </section>
  );
}
