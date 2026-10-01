import { useId, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { COMMUNES_SUGGEREES, communeAcceptee, communeDepuisCodePostal } from '../../menuCategories';
import SousEcran from '../SousEcran';
import AddressSearch from '../AddressSearch';
import AddressRecognition from '../AddressRecognition';
import BoutonEnregistrer from './BoutonEnregistrer';
import useEnregistrerCommerce from './useEnregistrerCommerce';

// Mon commerce › Adresse : celle où les livreurs viennent chercher les commandes et qui place le commerce
// sur la carte. La recherche d'adresse remplit les champs ; la reconnaissance vérifie ensuite que
// l'adresse existe — si elle n'est pas reconnue, il faut cocher « je confirme » avant d'enregistrer,
// comme dans l'ancien formulaire.
export default function EcranAdresse({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const toast = useToast();
  const ids = useId();
  const [commune, setCommune] = useState(restaurant.commune || '');
  const [quartier, setQuartier] = useState(restaurant.neighborhood || '');
  const [rue, setRue] = useState(restaurant.addressStreet || '');
  const [numero, setNumero] = useState(restaurant.addressNumber || '');
  const [cp, setCp] = useState(restaurant.addressPostalCode || '');
  const [recoEtat, setRecoEtat] = useState('idle');
  const [confirmee, setConfirmee] = useState(false);
  const { enregistrer, enCours } = useEnregistrerCommerce({ restoId, loadDashboard, onFermer });

  function valider() {
    if (!commune.trim()) { toast(t('editResto.toastCommuneRequired')); return; }
    if ((recoEtat === 'none' || recoEtat === 'error') && !confirmee) { toast(t('editResto.toastAddressConfirm')); return; }
    enregistrer({
      commune, addressCity: commune, neighborhood: quartier.trim(),
      addressStreet: rue.trim(), addressNumber: numero.trim(), addressPostalCode: cp.trim()
    });
  }

  return (
    <SousEcran titre={t('editResto.address')} onFermer={onFermer} pied={<BoutonEnregistrer enCours={enCours} onClick={valider} />}>
      <AddressSearch compact onSelect={(a) => { setRue(a.street); if (a.number) setNumero(a.number); if (a.postalCode) setCp(a.postalCode); if (a.city && communeAcceptee(a.city)) setCommune(a.city); }} />
      <div className="field"><label htmlFor={ids + '-rue'}>{t('editResto.streetForDrivers')}</label><input id={ids + '-rue'} value={rue} onChange={(e) => setRue(e.target.value)} placeholder={t('editResto.phStreet')} /></div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={ids + '-num'}>{t('editResto.number')}</label>
          <input id={ids + '-num'} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="12" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={ids + '-cp'}>{t('editResto.postalCode')}</label>
          <input id={ids + '-cp'} inputMode="numeric" value={cp} onChange={(e) => { setCp(e.target.value); const c = communeDepuisCodePostal(e.target.value); if (c) setCommune((v) => v || c); }} placeholder="1000" />
        </div>
      </div>
      <div className="field">
        <label htmlFor={ids + '-commune'}>{t('editResto.municipality')}</label>
        {/* Champ libre avec suggestions (les 19 communes puis la périphérie) : une liste fermée transformait Tervuren en Anderlecht. */}
        <input id={ids + '-commune'} list={ids + '-communes'} value={commune} onChange={(e) => setCommune(e.target.value)} placeholder="Ixelles, Tervuren…" autoComplete="address-level2" />
        <datalist id={ids + '-communes'}>
          {COMMUNES_SUGGEREES.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div className="field"><label htmlFor={ids + '-quartier'}>{t('editResto.neighbourhoodOptional')}</label><input id={ids + '-quartier'} value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder={t('editResto.phNeighbourhood')} /></div>
      <AddressRecognition
        street={rue} number={numero} postalCode={cp} city={commune} compact discret
        onResult={(r) => { if (r.commune && communeAcceptee(r.commune)) setCommune(r.commune); if (r.neighborhood) setQuartier((v) => v || r.neighborhood); }}
        onStatus={setRecoEtat} onConfirm={setConfirmee}
      />
    </SousEcran>
  );
}
