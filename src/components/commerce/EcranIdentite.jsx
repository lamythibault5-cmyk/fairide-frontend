import { useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';
import GalleryPickerModal from '../GalleryPickerModal';
import BoutonEnregistrer from './BoutonEnregistrer';
import useEnregistrerCommerce from './useEnregistrerCommerce';

// Mon commerce › Nom et photos : ce que le client voit en premier — nom, description, photo d'accueil, logo.
//
// Les champs sont initialisés UNE fois, au montage : le tableau de bord relit le commerce toutes les 15 s
// et un nouvel objet `restaurant` effacerait la saisie en cours (voir l'ancien garde-fou d'EditPage).
// Le sous-écran étant monté à l'ouverture et démonté à la fermeture, un useState suffit.
//
// Le sélecteur de photos est une modale (z-index 100) et le sous-écran une feuille (300) : ouverte
// par-dessus, la modale passerait dessous, et le piège à focus du sous-écran l'empêcherait d'être
// utilisée. On REMPLACE donc la feuille par le sélecteur le temps du choix ; l'état de ce composant
// (la saisie) survit, puisque c'est lui qui reste monté.
export default function EcranIdentite({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const [nom, setNom] = useState(restaurant.name || '');
  const [desc, setDesc] = useState(restaurant.desc || '');
  const [couverture, setCouverture] = useState(restaurant.coverImageUrl || '');
  const [logo, setLogo] = useState(restaurant.logoImageUrl || '');
  const [selecteur, setSelecteur] = useState(null); // null | { type: 'cover' | 'logo', suggestions }
  const { enregistrer, enCours } = useEnregistrerCommerce({ restoId, loadDashboard, onFermer });

  async function ouvrirSelecteur(type) {
    let suggestions = [];
    try {
      const r = await api(`/restaurants/${restoId}/${type}-suggestions`, { token });
      suggestions = r.images || [];
    } catch { /* sans suggestions, la galerie reste utilisable */ }
    setSelecteur({ type, suggestions });
  }

  function valider() {
    if (!nom.trim()) { toast(t('editResto.toastNameRequired')); return; }
    enregistrer({ name: nom.trim(), desc: desc.trim(), coverImageUrl: couverture.trim(), logoImageUrl: logo.trim() });
  }

  if (selecteur) {
    const estCouverture = selecteur.type === 'cover';
    return (
      <GalleryPickerModal
        restoId={restoId}
        currentImageUrl={estCouverture ? couverture : logo}
        suggestions={selecteur.suggestions}
        title={estCouverture ? t('editResto.coverTitle') : t('editResto.logoTitle')}
        suggestionsTitle={t('editResto.suggestionsFor', { cuisine: estCouverture ? restaurant.cuisine : restaurant.name })}
        onSelect={(url) => { if (estCouverture) setCouverture(url); else setLogo(url); setSelecteur(null); }}
        onCancel={() => setSelecteur(null)}
      />
    );
  }

  return (
    <SousEcran titre={t('editResto.rowIdentity')} onFermer={onFermer} pied={<BoutonEnregistrer enCours={enCours} onClick={valider} />}>
      <div className="field"><label htmlFor={ids + '-nom'}>{t('editResto.nameLabel')}</label><input id={ids + '-nom'} value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('editResto.phName')} /></div>
      <div className="field"><label htmlFor={ids + '-desc'}>{t('editResto.description')}</label><textarea id={ids + '-desc'} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field" role="group" aria-labelledby={ids + '-couv'}>
        <span className="titre-groupe" id={ids + '-couv'}>{t('editResto.coverTitle')}</span>
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {couverture && <img src={couverture} alt="" className="dish-thumb" style={{ flexShrink: 0 }} />}
          <button type="button" className="btn-ghost" onClick={() => ouvrirSelecteur('cover')}>{t('editResto.choosePhoto')}</button>
        </div>
      </div>
      <div className="field" role="group" aria-labelledby={ids + '-logo'}>
        <span className="titre-groupe" id={ids + '-logo'}>{t('editResto.logoTitle')}</span>
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {logo && <img src={logo} alt="" className="dish-thumb" style={{ flexShrink: 0, borderRadius: '50%' }} />}
          <button type="button" className="btn-ghost" onClick={() => ouvrirSelecteur('logo')}>{t('editResto.chooseLogo')}</button>
          {logo && <button type="button" className="btn-danger-ghost" onClick={() => setLogo('')}>{t('editResto.remove')}</button>}
        </div>
      </div>
    </SousEcran>
  );
}
