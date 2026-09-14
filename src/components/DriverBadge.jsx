import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Le livreur qui arrive, tel que le client le voit dans le suivi : sa photo de profil (déposée dans son dossier,
// copiée sur la commande à la prise en charge — voir orders.driver_photo_url), son prénom et son téléphone.
// Sans photo, ou si l'image ne se charge pas, ses initiales.

// Cloudinary : vignette carrée recadrée sur le visage, au bon format et légère, plutôt que la photo d'origine.
function vignette(url, taille) {
  if (!url) return '';
  return url.includes('/image/upload/') ? url.replace('/image/upload/', `/image/upload/c_fill,g_face,w_${taille},h_${taille},f_auto,q_auto/`) : url;
}

export default function DriverBadge({ name, phone, photoUrl, size = 48 }) {
  const { t } = useLanguage();
  const [erreur, setErreur] = useState(false);
  const initiales = String(name || '').trim().split(/\s+/).slice(0, 2).map((m) => m[0] || '').join('').toUpperCase();
  return (
    <span className="driver-badge">
      {photoUrl && !erreur ? (
        <img className="driver-badge-photo" src={vignette(photoUrl, size * 2)} width={size} height={size} alt={t('mapClient.courierPhotoAlt', { name: name || '' })} loading="lazy" onError={() => setErreur(true)} />
      ) : (
        <span className="driver-badge-photo driver-badge-initiales" style={{ width: size, height: size }} aria-hidden="true">{initiales || '🛵'}</span>
      )}
      <span className="driver-badge-texte">
        <span className="driver-badge-role">🛵 {t('mapClient.yourCourierLabel')}</span>
        <b>{name}</b>
        {phone && <a className="driver-badge-tel" href={`tel:${String(phone).replace(/[^+\d]/g, '')}`}>{phone}</a>}
      </span>
    </span>
  );
}
