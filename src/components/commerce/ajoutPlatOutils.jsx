import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { vibrer } from '../../gestes';

// Le calcul du prix et les deux crochets de AjoutPlat.jsx (le pourquoi y est), à part : un fichier de composants n'exporte
// que des composants (rafraîchissement à chaud de Vite).

// Prix affiché pour un prix du comptoir : le même, ou + la hausse arrondie aux 10 cents inférieurs (prixMagasin.js).
export function prixSurFairride(comptoir, pourcent) {
  const b = Number(comptoir);
  return pourcent > 0 ? Math.floor(b * (1 + pourcent / 100) * 10 + 1e-6) / 10 : Math.round(b * 100) / 100;
}
// « 12,5 », « 12.50 », « 12 € » → 12.5 ; vide ou illisible → null.
export function lirePrix(s) {
  const v = Number(String(s || '').replace(',', '.').replace(/[^\d.]/g, ''));
  return String(s || '').trim() && Number.isFinite(v) && v >= 0.1 ? Math.round(v * 100) / 100 : null;
}

// La règle de la carte : la hausse en vigueur (GET /price-markup, réservé au commerce) et le badge (restaurant.prixComptoir).
export function useRegleCarte(restoId, token, restaurant) {
  const [pourcent, setPourcent] = useState(0);
  useEffect(() => {
    let annule = false;
    api(`/restaurants/${restoId}/price-markup`, { token }).then((r) => { if (!annule) setPourcent(Number(r.percent) || 0); }).catch(() => {});
    return () => { annule = true; };
  }, [restoId, token]);
  return { pourcent, badge: !!restaurant.prixComptoir };
}

// Une photo pour un plat : un seul champ fichier caché, partagé par tous les carrés « + photo » de la carte.
export function usePhotoPlat(restoId, token, onFait) {
  const { t } = useLanguage();
  const toast = useToast();
  const champ = useRef(null);
  const cible = useRef(null);
  const [envoi, setEnvoi] = useState(null);
  async function envoyer(item, file) {
    setEnvoi(item.id);
    try {
      const r = await apiUpload(`/restaurants/${restoId}/menu/${item.id}/photo`, { file, token });
      vibrer('succes');
      toast(t('carteAjout.photoEnLigne'), 'succes');
      await onFait?.();
      return r;
    } catch (e) { toast(e.message, 'erreur'); return null; } finally { setEnvoi(null); }
  }
  const choisir = (item) => { cible.current = item; champ.current?.click(); };
  const input = (
    <input ref={champ} type="file" accept="image/*" hidden onChange={(e) => {
      const f = e.target.files?.[0]; e.target.value = '';
      if (f && cible.current) envoyer(cible.current, f);
    }} />
  );
  return { choisir, envoyer, envoi, input };
}
