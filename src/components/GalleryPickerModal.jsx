import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, apiUpload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

// Galerie personnelle du restaurant : upload depuis la pellicule/galerie du téléphone ou le disque de
// l'ordi/tablette (comportement natif de <input type="file" accept="image/*">, rien à coder de plus
// pour couvrir les deux cas), puis réutilisable sur n'importe quel plat sans re-uploader.
// currentImageUrl : photo actuellement utilisée par le plat (ou la photo d'accueil) qu'on est en train de
// modifier (si vide, rien à proposer de garder). Si elle n'est pas déjà dans la galerie, on propose de l'y
// archiver avant de basculer sur la nouvelle photo choisie, pour ne pas la perdre.
// suggestions : pool de photos pré-sélectionnées (ex: par type de commerce pour la photo d'accueil) affiché
// dans une section à part au-dessus de la galerie perso — pas de suppression possible sur ces vignettes.
export default function GalleryPickerModal({ restoId, currentImageUrl, onSelect, onCancel, suggestions = [], title = 'Ma galerie photos', suggestionsTitle = 'Suggestions' }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [images, setImages] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [keeping, setKeeping] = useState(false);
  const fileInputRef = useRef(null);

  function loadGallery() {
    api(`/restaurants/${restoId}/gallery/mine`, { token }).then(setImages).catch((e) => toast(e.message));
  }

  useEffect(() => {
    loadGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await apiUpload(`/restaurants/${restoId}/gallery`, { file, token });
      loadGallery();
    } catch (err) {
      toast(err.message);
    } finally {
      setUploading(false);
    }
  }

  function chooseImage(url) {
    const old = (currentImageUrl || '').trim();
    if (old && old !== url && !images?.some((img) => img.imageUrl === old)) {
      setPendingUrl(url);
      return;
    }
    onSelect(url);
  }

  async function keepOldAndSwitch() {
    setKeeping(true);
    try {
      await api(`/restaurants/${restoId}/gallery/from-url`, { method: 'POST', token, body: { imageUrl: currentImageUrl } });
    } catch (err) {
      toast(err.message);
    } finally {
      setKeeping(false);
    }
    onSelect(pendingUrl);
  }

  function discardOldAndSwitch() {
    onSelect(pendingUrl);
  }

  async function handleDelete(imageId) {
    setDeletingId(imageId);
    try {
      await api(`/restaurants/${restoId}/gallery/${imageId}`, { method: 'DELETE', token });
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err) {
      toast(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (pendingUrl) {
    return createPortal(
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('gallery.keepOldTitle')}</h3>
          <p className="small" style={{ margin: '0 0 14px' }}>
            {t('gallery.keepOldBody')}
          </p>
          <div className="row" style={{ gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <img src={currentImageUrl} alt={t('gallery.currentPhoto')} className="dish-thumb" />
            <span style={{ fontSize: 20 }}>→</span>
            <img src={pendingUrl} alt={t('gallery.newPhoto')} className="dish-thumb" />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-teal" disabled={keeping} onClick={keepOldAndSwitch}>
              {keeping ? '...' : t('gallery.yesKeep')}
            </button>
            <button type="button" className="btn-ghost" disabled={keeping} onClick={discardOldAndSwitch}>{t('gallery.noThanks')}</button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{title}</h3>

        {suggestions.length > 0 && (
          <>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>{suggestionsTitle}</h4>
            <div className="gallery-picker-grid" style={{ marginBottom: 16 }}>
              {suggestions.map((url) => (
                <div key={url} className="gallery-picker-tile">
                  <button type="button" className="gallery-picker-image-btn" onClick={() => chooseImage(url)} title={t('gallery.useThis')}>
                    <img loading="lazy" src={url} alt="" />
                  </button>
                </div>
              ))}
            </div>
            <div className="divider" />
          </>
        )}

        <p className="small" style={{ margin: '0 0 12px' }}>
          {t('gallery.intro')}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button type="button" className="btn-teal" disabled={uploading} onClick={() => fileInputRef.current?.click()} style={{ marginBottom: 14 }}>
          {uploading ? t('gallery.uploading') : t('gallery.addPhoto')}
        </button>

        {images === null && <div className="empty">{t('gallery.loading')}</div>}
        {images !== null && images.length === 0 && <div className="empty">{t('gallery.empty')}</div>}

        {images !== null && images.length > 0 && (
          <div className="gallery-picker-grid">
            {images.map((img) => (
              <div key={img.id} className="gallery-picker-tile">
                <button type="button" className="gallery-picker-image-btn" onClick={() => chooseImage(img.imageUrl)} title={t('gallery.useThis')}>
                  <img loading="lazy" src={img.imageUrl} alt="" />
                </button>
                <button
                  type="button"
                  className="gallery-picker-delete"
                  disabled={deletingId === img.id}
                  onClick={() => handleDelete(img.id)}
                  title={t('gallery.removeFromGallery')}
                >
                  {deletingId === img.id ? '...' : '🗑️'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button type="button" className="btn-ghost" onClick={onCancel}>{t('gallery.close')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
