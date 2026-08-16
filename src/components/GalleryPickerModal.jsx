import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, apiUpload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Galerie personnelle du restaurant : upload depuis la pellicule/galerie du téléphone ou le disque de
// l'ordi/tablette (comportement natif de <input type="file" accept="image/*">, rien à coder de plus
// pour couvrir les deux cas), puis réutilisable sur n'importe quel plat sans re-uploader.
export default function GalleryPickerModal({ restoId, onSelect, onCancel }) {
  const { token } = useAuth();
  const toast = useToast();
  const [images, setImages] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
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

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Ma galerie photos</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Ajoute des photos depuis ton téléphone (pellicule ou appareil photo) ou ton ordinateur, puis choisis-en une pour ce plat.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button type="button" className="btn-teal" disabled={uploading} onClick={() => fileInputRef.current?.click()} style={{ marginBottom: 14 }}>
          {uploading ? 'Envoi en cours...' : '+ Ajouter une photo'}
        </button>

        {images === null && <div className="empty">Chargement...</div>}
        {images !== null && images.length === 0 && <div className="empty">Ta galerie est vide pour l'instant.</div>}

        {images !== null && images.length > 0 && (
          <div className="gallery-picker-grid">
            {images.map((img) => (
              <div key={img.id} className="gallery-picker-tile">
                <button type="button" className="gallery-picker-image-btn" onClick={() => onSelect(img.imageUrl)} title="Utiliser cette photo">
                  <img src={img.imageUrl} alt="" />
                </button>
                <button
                  type="button"
                  className="gallery-picker-delete"
                  disabled={deletingId === img.id}
                  onClick={() => handleDelete(img.id)}
                  title="Supprimer de la galerie"
                >
                  {deletingId === img.id ? '...' : '🗑️'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button type="button" className="btn-ghost" onClick={onCancel}>Fermer</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
