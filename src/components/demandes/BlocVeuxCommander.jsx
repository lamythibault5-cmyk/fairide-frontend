import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';
import useMoiAussi from './useMoiAussi';
import { pourCommerce } from '../../demandes';
import '../../ecran-demandes.css';

/* « TU VOUDRAIS COMMANDER ICI ? » sur la fiche d'un commerce « Carte seule » (fondateur, 2026-10-26, version B ; 27 des 30
 * commerces publics l'étaient ce jour-là). On voit sa carte mais on ne peut pas y commander : « Moi aussi » dit qu'on le
 * voudrait, et l'équipe le montre au commerce qu'elle relance déjà. Pas dans la rangée « Demandés près de toi » : il est
 * déjà dans la liste. Bouton en contour (fiche sans action lime possible : on ne peut pas y commander). */
export default function BlocVeuxCommander({ restaurant }) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [etat, setEtat] = useState(null); // { id, total, moi }
  const { basculer, dialogue, occupe } = useMoiAussi();
  useEffect(() => {
    let annule = false;
    pourCommerce(restaurant.id, token).then((r) => { if (!annule) setEtat(r); }).catch(() => { if (!annule) setEtat({ id: null, total: 0, moi: false }); });
    return () => { annule = true; };
  }, [restaurant.id, token]);
  if (!etat) return null;
  const total = etat.total || 0;
  const texte = total === 0 ? t('demandes.veuxZero') : total === 1 ? t('demandes.veuxUn') : t('demandes.veuxPlus', { n: total });
  const d = { id: etat.id, nom: restaurant.name, moi: etat.moi, total };
  return (
    <div className="dm-veux">
      <h3>{t('demandes.veuxTitre')}</h3>
      <p>{texte}</p>
      <button type="button" className={`btn-outline dm-veux-bouton${etat.moi ? ' on' : ''}`} aria-pressed={!!etat.moi} disabled={occupe(etat.id)}
        onClick={() => basculer(d, { restaurantId: restaurant.id }, (s) => setEtat({ id: s.id, total: s.total, moi: s.moi }))}>
        {etat.moi ? <><Icone nom="coche" taille={17} />{t('demandes.veuxNote')}</> : t('demandes.moiAussi')}
      </button>
      {dialogue}
    </div>
  );
}
