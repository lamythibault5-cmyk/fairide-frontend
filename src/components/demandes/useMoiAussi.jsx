import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../ConfirmDialog';
import { vibrer } from '../../gestes';
import { demander, retirer, telephoneAVerifier, CHEMIN_VERIFIER_TELEPHONE } from '../../demandes';

/* « MOI AUSSI », PARTAGÉ par la rangée « Demandés près de toi » et le bloc d'une fiche « Carte seule ». Un toucher : la
 * carte change tout de suite (coche, nombre + 1), le serveur suit ; s'il refuse, elle revient et le message dit pourquoi.
 * Retoucher retire la demande. Sans compte : la connexion d'abord. Téléphone pas vérifié (REQUEST_PHONE_REQUIRED) : une
 * feuille explique pourquoi (une demande par personne) et mène à la vérification du numéro.
 *
 * `basculer(d, lieu, maj)` : `d` = { id, nom, moi, total } ; `lieu` = ce qu'on envoie si la demande n'existe pas encore
 * (fiche « Carte seule » : { restaurantId }) ; `maj(suivant)` reçoit l'état à afficher. */
export default function useMoiAussi() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [telephone, setTelephone] = useState(false);
  const [enCours, setEnCours] = useState(() => new Set());

  async function basculer(d, lieu, maj) {
    if (!user) { navigate('/login?audience=client', { state: { from: location.pathname + location.search } }); return; }
    const cle = d.id || JSON.stringify(lieu);
    if (enCours.has(cle)) return;
    setEnCours((s) => new Set(s).add(cle));
    vibrer('bascule');
    const avant = { ...d };
    maj({ ...d, moi: !d.moi, total: Math.max(0, (d.total || 0) + (d.moi ? -1 : 1)) });
    try {
      if (d.moi) {
        const r = await retirer(d.id, token);
        maj({ ...d, moi: false, total: r.total ?? Math.max(0, (d.total || 0) - 1) });
        toast(t('demandes.toastRetire'));
      } else {
        const r = await demander({ lieu: d.id ? { demandeId: d.id } : lieu }, token);
        maj({ ...d, id: r.demande?.id || d.id, moi: true, total: r.total });
        toast(t('demandes.toastNote', { nom: d.nom }));
      }
    } catch (e) {
      maj(avant);
      if (telephoneAVerifier(e)) setTelephone(true);
      else toast(e.message, 'erreur');
    } finally {
      setEnCours((s) => { const n = new Set(s); n.delete(cle); return n; });
    }
  }

  const dialogue = (
    <ConfirmDialog open={telephone} icone="telephone" title={t('demandes.telTitre')} message={t('demandes.telTexte')}
      confirmLabel={t('demandes.telBouton')} onConfirm={() => { setTelephone(false); navigate(CHEMIN_VERIFIER_TELEPHONE); }}
      onCancel={() => setTelephone(false)} />
  );
  return { basculer, dialogue, occupe: (id) => enCours.has(id) };
}
