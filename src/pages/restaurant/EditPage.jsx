import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { COMMUNES, RESTAURANT_TYPES, fullTemplateItems } from '../../menuCategories';
import OpeningHoursEditor from '../../components/OpeningHoursEditor';
import GalleryPickerModal from '../../components/GalleryPickerModal';
import { formatDateFr } from '../../openingHours';
import { useLanguage } from '../../context/LanguageContext';

// Valeurs envoyées au backend (en français, stockées telles quelles) ; le libellé affiché est traduit.
const RESTO_DELETION_REASONS = [
  'Je ferme mon commerce',
  'Je change de plateforme de livraison',
  'Trop peu de commandes',
  'Problème avec les commissions ou les livreurs',
  'Erreur de création, je recommence',
  'Autre raison'
];
const RESTO_DELETION_KEYS = ['reasonClosing', 'reasonSwitching', 'reasonFewOrders', 'reasonCommissions', 'reasonMistake', 'reasonOther'];

export default function EditPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, drivers, restoId, loadDashboard } = useOutletContext();

  const [editName, setEditName] = useState('');
  const [editLegalName, setEditLegalName] = useState('');
  const [editCompanyNumber, setEditCompanyNumber] = useState('');
  const [editVatNumber, setEditVatNumber] = useState('');
  const [editResponsibleName, setEditResponsibleName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCommune, setEditCommune] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editAddressStreet, setEditAddressStreet] = useState('');
  const [editAddressNumber, setEditAddressNumber] = useState('');
  const [editAddressPostalCode, setEditAddressPostalCode] = useState('');
  const [editCover, setEditCover] = useState('');
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverSuggestions, setCoverSuggestions] = useState([]);
  const [editLogo, setEditLogo] = useState('');
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [logoSuggestions, setLogoSuggestions] = useState([]);
  const [editHours, setEditHours] = useState(null);
  const [editOpenFlag, setEditOpenFlag] = useState(true);
  const [savingResto, setSavingResto] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState(RESTO_DELETION_REASONS[0]);
  const [deleteComment, setDeleteComment] = useState('');
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  const [sendingDeleteCode, setSendingDeleteCode] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');

  const [cuisineChangeOpen, setCuisineChangeOpen] = useState(false);
  const [newCuisine, setNewCuisine] = useState('');
  const [newCustomCuisine, setNewCustomCuisine] = useState('');
  const [cuisineCode, setCuisineCode] = useState('');
  const [cuisineCodeSent, setCuisineCodeSent] = useState(false);
  const [sendingCuisineCode, setSendingCuisineCode] = useState(false);
  const [replaceMenuChoice, setReplaceMenuChoice] = useState('keep');
  const [changingCuisine, setChangingCuisine] = useState(false);

  const [driverEmailInput, setDriverEmailInput] = useState('');
  const [linkingDriver, setLinkingDriver] = useState(false);
  const [unlinkingDriverId, setUnlinkingDriverId] = useState(null);
  const [switchingMode, setSwitchingMode] = useState(false);

  const [freeDeliveryEdit, setFreeDeliveryEdit] = useState(false);
  const [deliveryFeeDiscountEdit, setDeliveryFeeDiscountEdit] = useState('0');
  const [freeDeliveryMinOrderEnabled, setFreeDeliveryMinOrderEnabled] = useState(false);
  const [freeDeliveryMinOrderEdit, setFreeDeliveryMinOrderEdit] = useState('20');
  const [savingDeliveryOffer, setSavingDeliveryOffer] = useState(false);

  const [newClosureStart, setNewClosureStart] = useState('');
  const [newClosureEnd, setNewClosureEnd] = useState('');
  const [newClosureReason, setNewClosureReason] = useState('');
  const [addingClosure, setAddingClosure] = useState(false);
  const [deletingClosureId, setDeletingClosureId] = useState(null);

  // DashboardLayout relit /restaurants/:id toutes les 15s (voir loadDashboard), ce qui donne un nouvel
  // objet `restaurant` à chaque poll — sans ce garde-fou, le formulaire se réinitialisait sur CHAQUE
  // poll et effaçait ce que le restaurateur venait de taper avant même qu'il ait pu cliquer sur
  // Enregistrer (signalé : le nom retombait tout seul sur l'ancien). On ne (re)peuple les champs
  // qu'une fois par restaurant, pas à chaque rafraîchissement des mêmes données.
  const initializedRestoIdRef = useRef(null);
  useEffect(() => {
    if (!restaurant) return;
    if (initializedRestoIdRef.current === restaurant.id) return;
    initializedRestoIdRef.current = restaurant.id;
    setEditName(restaurant.name || '');
    setEditLegalName(restaurant.legalName || '');
    setEditCompanyNumber(restaurant.companyNumber || '');
    setEditVatNumber(restaurant.vatNumber || '');
    setEditResponsibleName(restaurant.responsibleName || '');
    setEditDesc(restaurant.desc || '');
    setEditCommune(restaurant.commune || COMMUNES[0]);
    setEditNeighborhood(restaurant.neighborhood || '');
    setEditAddressStreet(restaurant.addressStreet || '');
    setEditAddressNumber(restaurant.addressNumber || '');
    setEditAddressPostalCode(restaurant.addressPostalCode || '');
    setEditCover(restaurant.coverImageUrl || '');
    setEditLogo(restaurant.logoImageUrl || '');
    setEditHours(restaurant.hours || null);
    setEditOpenFlag(restaurant.open);
    setFreeDeliveryEdit(!!restaurant.freeDelivery);
    setDeliveryFeeDiscountEdit(String(restaurant.deliveryFeeDiscount || 0));
    setFreeDeliveryMinOrderEnabled(restaurant.freeDeliveryMinOrder != null);
    setFreeDeliveryMinOrderEdit(restaurant.freeDeliveryMinOrder != null ? String(restaurant.freeDeliveryMinOrder) : '20');
  }, [restaurant]);

  async function saveRestoInfo() {
    if (!editName.trim()) {
      toast(t('editResto.toastNameRequired'));
      return;
    }
    if (!editLegalName.trim() || !editCompanyNumber.trim() || !editVatNumber.trim() || !editResponsibleName.trim()) {
      toast(t('editResto.toastLegalRequired'));
      return;
    }
    if (!editHours || !Object.values(editHours).some((shifts) => Array.isArray(shifts) && shifts.length)) {
      toast(t('editResto.toastHoursRequired'));
      return;
    }
    setSavingResto(true);
    try {
      await api(`/restaurants/${restoId}`, {
        method: 'PATCH', token,
        body: {
          name: editName.trim(),
          legalName: editLegalName.trim(), companyNumber: editCompanyNumber.trim(), vatNumber: editVatNumber.trim(), responsibleName: editResponsibleName.trim(),
          desc: editDesc.trim(), commune: editCommune, neighborhood: editNeighborhood.trim(),
          addressStreet: editAddressStreet.trim(), addressNumber: editAddressNumber.trim(), addressPostalCode: editAddressPostalCode.trim(), addressCity: editCommune,
          coverImageUrl: editCover.trim(), logoImageUrl: editLogo.trim(), hours: editHours, open: editOpenFlag
        }
      });
      await loadDashboard(restoId);
      toast(t('editResto.toastUpdated'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSavingResto(false);
    }
  }

  async function addClosure() {
    if (!newClosureStart) { toast(t('editResto.toastStartDate')); return; }
    if (newClosureEnd && newClosureEnd < newClosureStart) { toast(t('editResto.toastEndAfterStart')); return; }
    setAddingClosure(true);
    try {
      await api(`/restaurants/${restoId}/closures`, {
        method: 'POST', token,
        body: { startDate: newClosureStart, endDate: newClosureEnd || null, reason: newClosureReason.trim() }
      });
      await loadDashboard(restoId);
      setNewClosureStart('');
      setNewClosureEnd('');
      setNewClosureReason('');
      toast(t('editResto.toastClosureAdded'));
    } catch (e) {
      toast(e.message);
    } finally {
      setAddingClosure(false);
    }
  }

  async function deleteClosure(closureId) {
    setDeletingClosureId(closureId);
    try {
      await api(`/restaurants/${restoId}/closures/${closureId}`, { method: 'DELETE', token });
      await loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setDeletingClosureId(null);
    }
  }

  async function openCoverPicker() {
    try {
      const r = await api(`/restaurants/${restoId}/cover-suggestions`, { token });
      setCoverSuggestions(r.images || []);
    } catch {
      setCoverSuggestions([]);
    }
    setCoverPickerOpen(true);
  }

  async function openLogoPicker() {
    try {
      const r = await api(`/restaurants/${restoId}/logo-suggestions`, { token });
      setLogoSuggestions(r.images || []);
    } catch {
      setLogoSuggestions([]);
    }
    setLogoPickerOpen(true);
  }

  function openCuisineChange() {
    const knownType = RESTAURANT_TYPES.some((c) => c.value === restaurant.cuisine);
    setNewCuisine(knownType ? restaurant.cuisine : 'Autre');
    setNewCustomCuisine(knownType ? '' : (restaurant.cuisine || ''));
    setCuisineChangeOpen(true);
  }

  async function sendCuisineCode() {
    setSendingCuisineCode(true);
    try {
      await api(`/restaurants/${restoId}/request-cuisine-change`, { method: 'POST', token });
      setCuisineCodeSent(true);
      toast(t('editResto.toastCodeSent'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSendingCuisineCode(false);
    }
  }

  async function confirmCuisineChange() {
    if (changingCuisine) return; // évite un double-clic qui rejouerait tout le flux (wipe + réinsertion)
    if (!cuisineCode) { toast(t('editResto.toastEnterCode')); return; }
    const finalCuisine = newCuisine === 'Autre' ? newCustomCuisine.trim() || 'Autre' : newCuisine;
    setChangingCuisine(true);
    try {
      await api(`/restaurants/${restoId}/cuisine`, {
        method: 'PATCH', token,
        body: { cuisine: finalCuisine, code: cuisineCode, wipeMenu: replaceMenuChoice === 'replace' }
      });
      if (replaceMenuChoice === 'replace') {
        const items = fullTemplateItems(finalCuisine);
        if (items.length) await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      }
      await loadDashboard(restoId);
      setCuisineChangeOpen(false);
      setCuisineCode('');
      setCuisineCodeSent(false);
      setReplaceMenuChoice('keep');
      toast(t('editResto.toastTypeUpdated'));
    } catch (e) {
      toast(e.message);
    } finally {
      setChangingCuisine(false);
    }
  }

  async function sendDeleteCode() {
    setSendingDeleteCode(true);
    try {
      await api(`/restaurants/${restoId}/request-deletion`, { method: 'POST', token });
      setDeleteCodeSent(true);
      toast(t('editResto.toastCodeSent'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSendingDeleteCode(false);
    }
  }

  async function deleteRestaurant() {
    if (!deleteCode) { toast(t('editResto.toastEnterCode')); return; }
    setDeleting(true);
    try {
      await api(`/restaurants/${restoId}`, { method: 'DELETE', token, body: { code: deleteCode, reason: deleteReason, comment: deleteComment.trim() } });
      toast(t('editResto.toastDeleted'));
      window.location.href = '/dashboard';
    } catch (e) {
      toast(e.message);
      setDeleting(false);
    }
  }

  async function linkDriver() {
    if (!driverEmailInput.trim()) { toast(t('editResto.toastDriverEmail')); return; }
    setLinkingDriver(true);
    try {
      const driver = await api(`/restaurants/${restoId}/drivers`, { method: 'POST', token, body: { email: driverEmailInput.trim() } });
      await loadDashboard(restoId);
      setDriverEmailInput('');
      toast(t('editResto.toastDriverLinked', { name: driver.name }));
    } catch (e) {
      toast(e.message);
    } finally {
      setLinkingDriver(false);
    }
  }

  async function unlinkDriver(driverId) {
    setUnlinkingDriverId(driverId);
    try {
      await api(`/restaurants/${restoId}/drivers/${driverId}`, { method: 'DELETE', token });
      await loadDashboard(restoId);
      toast(t('editResto.toastDriverRemoved'));
    } catch (e) {
      toast(e.message);
    } finally {
      setUnlinkingDriverId(null);
    }
  }

  async function switchDeliveryMode(mode) {
    setSwitchingMode(true);
    try {
      await api(`/restaurants/${restoId}/delivery-mode`, { method: 'PATCH', token, body: { mode } });
      await loadDashboard(restoId);
      toast(mode === 'own' ? t('editResto.toastInternalOn') : t('editResto.toastBackToPool'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSwitchingMode(false);
    }
  }

  // Le restaurant prend à sa charge tout ou partie du tarif livreur pour se démarquer sur la liste des
  // restos (visible côté client comme un badge, voir RestaurantList.jsx) — le livreur et Fairide ne
  // sont jamais affectés, voir le calcul détaillé dans routes/orders.js côté backend.
  async function saveDeliveryOffer() {
    const discount = Number(deliveryFeeDiscountEdit);
    if (!freeDeliveryEdit && (Number.isNaN(discount) || discount < 0 || discount > 50)) {
      toast(t('editResto.toastAmount0_50'));
      return;
    }
    let minOrder = null;
    if (!freeDeliveryEdit && freeDeliveryMinOrderEnabled) {
      minOrder = Number(freeDeliveryMinOrderEdit);
      if (Number.isNaN(minOrder) || minOrder < 5 || minOrder > 200) {
        toast(t('editResto.toastAmount5_200'));
        return;
      }
    }
    setSavingDeliveryOffer(true);
    try {
      await api(`/restaurants/${restoId}/delivery-discount`, {
        method: 'PATCH', token,
        body: { freeDelivery: freeDeliveryEdit, deliveryFeeDiscount: freeDeliveryEdit ? 0 : discount, freeDeliveryMinOrder: minOrder }
      });
      await loadDashboard(restoId);
      toast(t('editResto.toastOfferUpdated'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSavingDeliveryOffer(false);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('editResto.title')}</h2>

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{t('editResto.infoTitle')}</h3>
        <div className="field"><label>{t('editResto.nameLabel')}</label><input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t('editResto.phName')} /></div>

        <div className="divider" />
        <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>{t('editResto.legalTitle')}</h4>
        <div className="field"><label>{t('editResto.legalName')}</label><input value={editLegalName} onChange={(e) => setEditLegalName(e.target.value)} placeholder={t('editResto.phLegalName')} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{t('editResto.companyNumber')}</label>
            <input value={editCompanyNumber} onChange={(e) => setEditCompanyNumber(e.target.value)} placeholder="0123.456.789" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{t('editResto.vatNumber')}</label>
            <input value={editVatNumber} onChange={(e) => setEditVatNumber(e.target.value)} placeholder={t('editResto.phVat')} />
          </div>
        </div>
        <div className="field"><label>{t('editResto.manager')}</label><input value={editResponsibleName} onChange={(e) => setEditResponsibleName(e.target.value)} placeholder={t('editResto.phManager')} /></div>

        <div className="divider" />
        <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>{t('editResto.address')}</h4>
        <div className="field">
          <label>{t('editResto.municipality')}</label>
          <select value={editCommune} onChange={(e) => setEditCommune(e.target.value)}>
            {COMMUNES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field"><label>{t('editResto.neighbourhoodOptional')}</label><input value={editNeighborhood} onChange={(e) => setEditNeighborhood(e.target.value)} placeholder={t('editResto.phNeighbourhood')} /></div>
        <div className="field"><label>{t('editResto.streetForDrivers')}</label><input value={editAddressStreet} onChange={(e) => setEditAddressStreet(e.target.value)} placeholder={t('editResto.phStreet')} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{t('editResto.number')}</label>
            <input value={editAddressNumber} onChange={(e) => setEditAddressNumber(e.target.value)} placeholder="12" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{t('editResto.postalCode')}</label>
            <input value={editAddressPostalCode} onChange={(e) => setEditAddressPostalCode(e.target.value)} placeholder="1000" />
          </div>
        </div>
        <div className="field"><label>{t('editResto.description')}</label><input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
        <div className="field">
          <label>{t('editResto.coverLabel')}</label>
          <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {editCover && <img src={editCover} alt="" className="dish-thumb" style={{ flexShrink: 0 }} />}
            <button type="button" className="btn-ghost" onClick={openCoverPicker}>{t('editResto.choosePhoto')}</button>
          </div>
        </div>
        {coverPickerOpen && (
          <GalleryPickerModal
            restoId={restoId}
            currentImageUrl={editCover}
            suggestions={coverSuggestions}
            title={t('editResto.coverTitle')}
            suggestionsTitle={t('editResto.suggestionsFor', { cuisine: restaurant.cuisine })}
            onSelect={(url) => { setEditCover(url); setCoverPickerOpen(false); }}
            onCancel={() => setCoverPickerOpen(false)}
          />
        )}
        <div className="field">
          <label>{t('editResto.logoLabel')}</label>
          <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {editLogo && <img src={editLogo} alt="" className="dish-thumb" style={{ flexShrink: 0, borderRadius: '50%' }} />}
            <button type="button" className="btn-ghost" onClick={openLogoPicker}>{t('editResto.chooseLogo')}</button>
            {editLogo && <button type="button" className="btn-danger-ghost" onClick={() => setEditLogo('')}>{t('editResto.remove')}</button>}
          </div>
        </div>
        {logoPickerOpen && (
          <GalleryPickerModal
            restoId={restoId}
            currentImageUrl={editLogo}
            suggestions={logoSuggestions}
            title={t('editResto.logoTitle')}
            suggestionsTitle={t('editResto.suggestionsFor', { cuisine: restaurant.name })}
            onSelect={(url) => { setEditLogo(url); setLogoPickerOpen(false); }}
            onCancel={() => setLogoPickerOpen(false)}
          />
        )}
        <label>{t('editResto.openingHours')}</label>
        <OpeningHoursEditor value={editHours} onChange={setEditHours} />
        <label className="row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={editOpenFlag} onChange={(e) => setEditOpenFlag(e.target.checked)} />
          <span className="small">{t('editResto.openVisible')}</span>
        </label>
        <button className="btn-teal" disabled={savingResto} onClick={saveRestoInfo}>{savingResto ? '...' : 'Enregistrer'}</button>

        <div className="divider" />
        <label>{t('editResto.closuresTitle')}</label>
        <p className="small" style={{ margin: '0 0 10px' }}>
          {t('editResto.closuresIntro')}
        </p>
        {(restaurant.closures || []).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {restaurant.closures.map((c) => (
              <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div className="small" style={{ fontWeight: 600 }}>
                    {formatDateFr(c.startDate)}{c.endDate ? ` → ${formatDateFr(c.endDate)}` : t('editResto.reopenUnknown')}
                  </div>
                  {c.reason && <div className="small">{c.reason}</div>}
                </div>
                <button type="button" className="btn-danger-ghost" disabled={deletingClosureId === c.id} onClick={() => deleteClosure(c.id)}>
                  {deletingClosureId === c.id ? '...' : 'Supprimer'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t('editResto.from')}</label>
            <input type="date" value={newClosureStart} onChange={(e) => setNewClosureStart(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t('editResto.toOptional')}</label>
            <input type="date" value={newClosureEnd} onChange={(e) => setNewClosureEnd(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label>{t('editResto.reasonVisible')}</label>
            <input value={newClosureReason} onChange={(e) => setNewClosureReason(e.target.value)} placeholder={t('editResto.phClosureReason')} />
          </div>
          <button className="btn-teal" disabled={addingClosure} onClick={addClosure}>{addingClosure ? '...' : '+ Ajouter'}</button>
        </div>

        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: cuisineChangeOpen ? 10 : 0 }}>
          <span className="small">{t('editResto.businessTypeColon')} <b>{restaurant.cuisine}</b></span>
          {!cuisineChangeOpen && <button className="btn-ghost" onClick={openCuisineChange}>{t('editResto.changeType')}</button>}
        </div>
        {cuisineChangeOpen && (
          <div>
            <p className="small" style={{ marginBottom: 8 }}>
              {t('editResto.changeTypeHelp')}
            </p>
            <div className="field">
              <label>{t('editResto.newType')}</label>
              <select value={newCuisine} onChange={(e) => setNewCuisine(e.target.value)}>
                {RESTAURANT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
              </select>
            </div>
            {newCuisine === 'Autre' && (
              <div className="field"><label>{t('editResto.specifyType')}</label><input value={newCustomCuisine} onChange={(e) => setNewCustomCuisine(e.target.value)} placeholder={t('editResto.phType')} /></div>
            )}
            <div className="field">
              <label>{t('editResto.whatAboutMenu')}</label>
              <select value={replaceMenuChoice} onChange={(e) => setReplaceMenuChoice(e.target.value)}>
                <option value="keep">{t('editResto.keepDishes')}</option>
                <option value="replace">{t('editResto.replaceDishes')}</option>
              </select>
            </div>
            {!cuisineCodeSent && (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-outline" disabled={sendingCuisineCode} onClick={sendCuisineCode}>
                  {sendingCuisineCode ? '...' : t('editResto.getConfirmCode')}
                </button>
                <button className="btn-ghost" onClick={() => setCuisineChangeOpen(false)}>{t('editResto.cancel')}</button>
              </div>
            )}
            {cuisineCodeSent && (
              <>
                <p className="small" style={{ margin: '10px 0' }}>
                  {t('editResto.codeSentHelp')}
                </p>
                <div className="field">
                  <label>{t('editResto.codeByEmail')}</label>
                  <input value={cuisineCode} onChange={(e) => setCuisineCode(e.target.value)} placeholder="123456" maxLength={6} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-teal" disabled={changingCuisine} onClick={confirmCuisineChange}>
                    {changingCuisine ? '...' : t('editResto.confirmChange')}
                  </button>
                  <button className="btn-ghost" disabled={sendingCuisineCode} onClick={sendCuisineCode}>{t('editResto.resendCode')}</button>
                  <button className="btn-ghost" onClick={() => { setCuisineChangeOpen(false); setCuisineCodeSent(false); setCuisineCode(''); }}>{t('editResto.cancel')}</button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="divider" />
        {!confirmDelete && (
          <button className="btn-danger-ghost" onClick={() => setConfirmDelete(true)}>{t('editResto.deleteTitle')}</button>
        )}
        {confirmDelete && (
          <div>
            <p className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>
              {t('editResto.deleteConfirm')}
            </p>
            <div className="field">
              <label>{t('editResto.deleteWhy')}</label>
              <select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                {RESTO_DELETION_REASONS.map((r, i) => <option key={r} value={r}>{t(`editResto.${RESTO_DELETION_KEYS[i]}`)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('editResto.commentOptional')}</label>
              <input value={deleteComment} onChange={(e) => setDeleteComment(e.target.value)} placeholder={t('editResto.phComment')} />
            </div>
            {!deleteCodeSent && (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={sendingDeleteCode} onClick={sendDeleteCode}>
                  {sendingDeleteCode ? '...' : t('editResto.getDeleteCode')}
                </button>
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>{t('editResto.cancel')}</button>
              </div>
            )}
            {deleteCodeSent && (
              <>
                <p className="small" style={{ marginBottom: 10 }}>
                  {t('editResto.deleteRequestSent')}
                </p>
                <div className="field">
                  <label>{t('editResto.codeByEmail')}</label>
                  <input value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder="123456" maxLength={6} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={deleting} onClick={deleteRestaurant}>
                    {deleting ? '...' : t('editResto.yesDelete')}
                  </button>
                  <button className="btn-ghost" disabled={sendingDeleteCode} onClick={sendDeleteCode}>{t('editResto.resendCode')}</button>
                  <button className="btn-ghost" onClick={() => { setConfirmDelete(false); setDeleteCodeSent(false); setDeleteCode(''); }}>{t('editResto.cancel')}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t('editResto.deliveryTitle')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          {restaurant.deliveryMode === 'own'
            ? t('editResto.internalOnInfo')
            : t('editResto.poolInfo')}
        </p>

        {drivers.length === 0 && (
          <p className="small" style={{ margin: '0 0 10px' }}>{t('editResto.noDedicatedDriver')}</p>
        )}
        {drivers.map((d) => (
          <div key={d.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
            <span>
              {d.name} <span className="small">· {d.email}</span>
              {d.adminStatus !== 'approved' && <span className="pill" style={{ marginLeft: 6 }}>{d.adminStatus === 'blocked' ? t('editResto.blocked') : t('editResto.pendingValidation')}</span>}
            </span>
            <button className="btn-danger-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={unlinkingDriverId === d.id} onClick={() => unlinkDriver(d.id)}>
              {unlinkingDriverId === d.id ? '...' : 'Retirer'}
            </button>
          </div>
        ))}

        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 200 }}
            value={driverEmailInput}
            onChange={(e) => setDriverEmailInput(e.target.value)}
            placeholder={t('editResto.phDriverEmail')}
          />
          <button className="btn-ghost" disabled={linkingDriver} onClick={linkDriver}>{linkingDriver ? '...' : t('editResto.linkDriver')}</button>
        </div>

        <div className="divider" />
        {restaurant.deliveryMode === 'fairide' ? (
          <button className="btn-teal" disabled={switchingMode || drivers.length === 0} onClick={() => switchDeliveryMode('own')} title={drivers.length === 0 ? t('editResto.linkOneDriver') : ''}>
            {switchingMode ? '...' : t('editResto.switchInternal')}
          </button>
        ) : (
          <button className="btn-ghost" disabled={switchingMode} onClick={() => switchDeliveryMode('fairide')}>
            {switchingMode ? '...' : t('editResto.switchPool')}
          </button>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t('editResto.deliveryFeesTitle')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          {t('editResto.deliveryFeesIntro')}
        </p>
        <label className="row" style={{ gap: 8, marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={freeDeliveryEdit} onChange={(e) => setFreeDeliveryEdit(e.target.checked)} />
          <span>{t('editResto.freeDelivery')}</span>
        </label>
        {!freeDeliveryEdit && (
          <div className="field" style={{ maxWidth: 220 }}>
            <label>{t('editResto.fixedDiscount')}</label>
            <input type="number" min="0" max="50" step="0.5" value={deliveryFeeDiscountEdit} onChange={(e) => setDeliveryFeeDiscountEdit(e.target.value)} placeholder={t('editResto.phEx2')} />
          </div>
        )}
        {!freeDeliveryEdit && (
          <>
            <label className="row" style={{ gap: 8, margin: '12px 0 10px', cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={freeDeliveryMinOrderEnabled} onChange={(e) => setFreeDeliveryMinOrderEnabled(e.target.checked)} />
              <span>{t('editResto.freeDeliveryFrom')}</span>
            </label>
            {freeDeliveryMinOrderEnabled && (
              <div className="field" style={{ maxWidth: 220 }}>
                <label>{t('editResto.minOrderAmount')}</label>
                <input type="number" min="5" max="200" step="1" value={freeDeliveryMinOrderEdit} onChange={(e) => setFreeDeliveryMinOrderEdit(e.target.value)} placeholder={t('editResto.phEx25')} />
              </div>
            )}
          </>
        )}
        <button className="btn-teal" style={{ marginTop: 10 }} disabled={savingDeliveryOffer} onClick={saveDeliveryOffer}>
          {savingDeliveryOffer ? '...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
