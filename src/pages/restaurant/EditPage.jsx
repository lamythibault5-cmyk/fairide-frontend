import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { COMMUNES, RESTAURANT_TYPES, fullTemplateItems } from '../../menuCategories';
import OpeningHoursEditor from '../../components/OpeningHoursEditor';
import GalleryPickerModal from '../../components/GalleryPickerModal';

const RESTO_DELETION_REASONS = [
  'Je ferme mon commerce',
  'Je change de plateforme de livraison',
  'Trop peu de commandes',
  'Problème avec les commissions ou les livreurs',
  'Erreur de création, je recommence',
  'Autre raison'
];

export default function EditPage() {
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

  useEffect(() => {
    if (!restaurant) return;
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
    setEditHours(restaurant.hours || null);
    setEditOpenFlag(restaurant.open);
  }, [restaurant]);

  async function saveRestoInfo() {
    if (!editName.trim()) {
      toast('Le nom du restaurant est requis.');
      return;
    }
    if (!editLegalName.trim() || !editCompanyNumber.trim() || !editVatNumber.trim() || !editResponsibleName.trim()) {
      toast("Les informations légales du commerce sont requises (nom légal, n° d'entreprise, n° TVA, responsable).");
      return;
    }
    if (!editHours || !Object.values(editHours).some((shifts) => Array.isArray(shifts) && shifts.length)) {
      toast('Indique tes horaires d\'ouverture : ton commerce ne sera visible que pendant ces créneaux.');
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
          coverImageUrl: editCover.trim(), hours: editHours, open: editOpenFlag
        }
      });
      await loadDashboard(restoId);
      toast('Restaurant mis à jour.');
    } catch (e) {
      toast(e.message);
    } finally {
      setSavingResto(false);
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
      toast('Code envoyé par email.');
    } catch (e) {
      toast(e.message);
    } finally {
      setSendingCuisineCode(false);
    }
  }

  async function confirmCuisineChange() {
    if (changingCuisine) return; // évite un double-clic qui rejouerait tout le flux (wipe + réinsertion)
    if (!cuisineCode) { toast('Entre le code reçu par email.'); return; }
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
      toast('Type de commerce mis à jour.');
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
      toast('Code envoyé par email.');
    } catch (e) {
      toast(e.message);
    } finally {
      setSendingDeleteCode(false);
    }
  }

  async function deleteRestaurant() {
    if (!deleteCode) { toast('Entre le code reçu par email.'); return; }
    setDeleting(true);
    try {
      await api(`/restaurants/${restoId}`, { method: 'DELETE', token, body: { code: deleteCode, reason: deleteReason, comment: deleteComment.trim() } });
      toast('Restaurant supprimé.');
      window.location.href = '/dashboard';
    } catch (e) {
      toast(e.message);
      setDeleting(false);
    }
  }

  async function linkDriver() {
    if (!driverEmailInput.trim()) { toast('Entre l\'email du livreur.'); return; }
    setLinkingDriver(true);
    try {
      const driver = await api(`/restaurants/${restoId}/drivers`, { method: 'POST', token, body: { email: driverEmailInput.trim() } });
      await loadDashboard(restoId);
      setDriverEmailInput('');
      toast(`${driver.name} est maintenant ton livreur dédié.`);
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
      toast('Livreur retiré.');
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
      toast(mode === 'own' ? 'Livraison interne activée — tes commandes ne sont proposées qu\'à ton/tes livreur(s) dédié(s).' : 'Retour au pool de livreurs Fairide.');
    } catch (e) {
      toast(e.message);
    } finally {
      setSwitchingMode(false);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Modifier mon restaurant</h2>

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Infos du restaurant</h3>
        <div className="field"><label>Nom du restaurant (affiché aux clients)</label><input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ex: Chez Momo" /></div>

        <div className="divider" />
        <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Informations légales</h4>
        <div className="field"><label>Nom légal / entreprise</label><input value={editLegalName} onChange={(e) => setEditLegalName(e.target.value)} placeholder="Ex: HORECA BRUSSELS SRL" /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>N° d'entreprise (BCE)</label>
            <input value={editCompanyNumber} onChange={(e) => setEditCompanyNumber(e.target.value)} placeholder="0123.456.789" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>N° TVA</label>
            <input value={editVatNumber} onChange={(e) => setEditVatNumber(e.target.value)} placeholder="BE0123.456.789" />
          </div>
        </div>
        <div className="field"><label>Responsable</label><input value={editResponsibleName} onChange={(e) => setEditResponsibleName(e.target.value)} placeholder="Nom du responsable légal" /></div>

        <div className="divider" />
        <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Adresse</h4>
        <div className="field">
          <label>Commune</label>
          <select value={editCommune} onChange={(e) => setEditCommune(e.target.value)}>
            {COMMUNES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field"><label>Quartier (optionnel)</label><input value={editNeighborhood} onChange={(e) => setEditNeighborhood(e.target.value)} placeholder="Ex: Châtelain, Flagey..." /></div>
        <div className="field"><label>Rue / Avenue (pour les livreurs et la carte)</label><input value={editAddressStreet} onChange={(e) => setEditAddressStreet(e.target.value)} placeholder="Rue du Midi" /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Numéro</label>
            <input value={editAddressNumber} onChange={(e) => setEditAddressNumber(e.target.value)} placeholder="12" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Code postal</label>
            <input value={editAddressPostalCode} onChange={(e) => setEditAddressPostalCode(e.target.value)} placeholder="1000" />
          </div>
        </div>
        <div className="field"><label>Description</label><input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
        <div className="field">
          <label>Photo d'accueil (visible dans la liste et en haut de ta page)</label>
          <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {editCover && <img src={editCover} alt="" className="dish-thumb" style={{ flexShrink: 0 }} />}
            <button type="button" className="btn-ghost" onClick={openCoverPicker}>📷 Choisir une photo</button>
          </div>
        </div>
        {coverPickerOpen && (
          <GalleryPickerModal
            restoId={restoId}
            currentImageUrl={editCover}
            suggestions={coverSuggestions}
            title="Photo d'accueil"
            suggestionsTitle={`Suggestions pour ${restaurant.cuisine}`}
            onSelect={(url) => { setEditCover(url); setCoverPickerOpen(false); }}
            onCancel={() => setCoverPickerOpen(false)}
          />
        )}
        <label>Horaires d'ouverture</label>
        <OpeningHoursEditor value={editHours} onChange={setEditHours} />
        <label className="row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={editOpenFlag} onChange={(e) => setEditOpenFlag(e.target.checked)} />
          <span className="small">Restaurant ouvert (visible aux clients)</span>
        </label>
        <button className="btn-teal" disabled={savingResto} onClick={saveRestoInfo}>{savingResto ? '...' : 'Enregistrer'}</button>

        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: cuisineChangeOpen ? 10 : 0 }}>
          <span className="small">Type de commerce : <b>{restaurant.cuisine}</b></span>
          {!cuisineChangeOpen && <button className="btn-ghost" onClick={openCuisineChange}>Changer de type</button>}
        </div>
        {cuisineChangeOpen && (
          <div>
            <p className="small" style={{ marginBottom: 8 }}>
              Changer de type demande une confirmation par email (fonctionne aussi pour les comptes connectés via Google).
            </p>
            <div className="field">
              <label>Nouveau type</label>
              <select value={newCuisine} onChange={(e) => setNewCuisine(e.target.value)}>
                {RESTAURANT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
              </select>
            </div>
            {newCuisine === 'Autre' && (
              <div className="field"><label>Précise le type</label><input value={newCustomCuisine} onChange={(e) => setNewCustomCuisine(e.target.value)} placeholder="Ex: Grec, Mexicain..." /></div>
            )}
            <div className="field">
              <label>Que faire de ton menu actuel ?</label>
              <select value={replaceMenuChoice} onChange={(e) => setReplaceMenuChoice(e.target.value)}>
                <option value="keep">Garder mes plats actuels tels quels</option>
                <option value="replace">Remplacer par les plats types du nouveau type</option>
              </select>
            </div>
            {!cuisineCodeSent && (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-outline" disabled={sendingCuisineCode} onClick={sendCuisineCode}>
                  {sendingCuisineCode ? '...' : 'Recevoir un code de confirmation'}
                </button>
                <button className="btn-ghost" onClick={() => setCuisineChangeOpen(false)}>Annuler</button>
              </div>
            )}
            {cuisineCodeSent && (
              <>
                <p className="small" style={{ margin: '10px 0' }}>
                  Un code de confirmation vient de t'être envoyé par email. Entre-le ci-dessous pour finaliser le changement.
                </p>
                <div className="field">
                  <label>Code reçu par email</label>
                  <input value={cuisineCode} onChange={(e) => setCuisineCode(e.target.value)} placeholder="123456" maxLength={6} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-teal" disabled={changingCuisine} onClick={confirmCuisineChange}>
                    {changingCuisine ? '...' : 'Confirmer le changement'}
                  </button>
                  <button className="btn-ghost" disabled={sendingCuisineCode} onClick={sendCuisineCode}>Renvoyer le code</button>
                  <button className="btn-ghost" onClick={() => { setCuisineChangeOpen(false); setCuisineCodeSent(false); setCuisineCode(''); }}>Annuler</button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="divider" />
        {!confirmDelete && (
          <button className="btn-danger-ghost" onClick={() => setConfirmDelete(true)}>🗑️ Supprimer ce restaurant</button>
        )}
        {confirmDelete && (
          <div>
            <p className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>
              Es-tu sûr ? Cette action est irréversible (plats supprimés aussi). Impossible si des commandes existent déjà.
            </p>
            <div className="field">
              <label>Pourquoi supprimes-tu ce restaurant ?</label>
              <select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                {RESTO_DELETION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Un commentaire (optionnel)</label>
              <input value={deleteComment} onChange={(e) => setDeleteComment(e.target.value)} placeholder="Aide-nous à nous améliorer..." />
            </div>
            {!deleteCodeSent && (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={sendingDeleteCode} onClick={sendDeleteCode}>
                  {sendingDeleteCode ? '...' : 'Recevoir un code de validation de suppression'}
                </button>
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Annuler</button>
              </div>
            )}
            {deleteCodeSent && (
              <>
                <p className="small" style={{ marginBottom: 10 }}>
                  Un code de validation de suppression vient de t'être envoyé par email. Entre-le ci-dessous pour finaliser la suppression.
                </p>
                <div className="field">
                  <label>Code reçu par email</label>
                  <input value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder="123456" maxLength={6} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={deleting} onClick={deleteRestaurant}>
                    {deleting ? '...' : 'Oui, supprimer définitivement'}
                  </button>
                  <button className="btn-ghost" disabled={sendingDeleteCode} onClick={sendDeleteCode}>Renvoyer le code</button>
                  <button className="btn-ghost" onClick={() => { setConfirmDelete(false); setDeleteCodeSent(false); setDeleteCode(''); }}>Annuler</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🛵 Livraison</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          {restaurant.deliveryMode === 'own'
            ? "Livraison interne activée — seuls tes livreurs dédiés voient et prennent tes commandes. Même processus que les autres livreurs Fairide (retrait/livraison par code, position en direct)."
            : "Livraison via le pool de livreurs Fairide — n'importe quel livreur validé peut prendre tes commandes."}
        </p>

        {drivers.length === 0 && (
          <p className="small" style={{ margin: '0 0 10px' }}>Aucun livreur dédié pour l'instant.</p>
        )}
        {drivers.map((d) => (
          <div key={d.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
            <span>
              {d.name} <span className="small">· {d.email}</span>
              {d.adminStatus !== 'approved' && <span className="pill" style={{ marginLeft: 6 }}>{d.adminStatus === 'blocked' ? '🚫 Bloqué' : '🕐 En attente de validation Fairide'}</span>}
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
            placeholder="Email du livreur (doit déjà avoir un compte livreur Fairide)"
          />
          <button className="btn-ghost" disabled={linkingDriver} onClick={linkDriver}>{linkingDriver ? '...' : '+ Lier ce livreur'}</button>
        </div>

        <div className="divider" />
        {restaurant.deliveryMode === 'fairide' ? (
          <button className="btn-teal" disabled={switchingMode || drivers.length === 0} onClick={() => switchDeliveryMode('own')} title={drivers.length === 0 ? 'Lie au moins un livreur pour activer ce mode' : ''}>
            {switchingMode ? '...' : 'Passer en livraison interne (mon/mes livreur(s))'}
          </button>
        ) : (
          <button className="btn-ghost" disabled={switchingMode} onClick={() => switchDeliveryMode('fairide')}>
            {switchingMode ? '...' : 'Repasser au pool de livreurs Fairide'}
          </button>
        )}
      </div>
    </div>
  );
}
