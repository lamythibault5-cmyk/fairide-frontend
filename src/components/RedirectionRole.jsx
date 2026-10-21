import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

/* UNE PAGE D'UN AUTRE RÔLE : ON LE DIT, PUIS ON MÈNE À « MES CASQUETTES » (audit du 19/10, auth-17).
 *
 * Un client connecté qui touchait « Devenir livreur », ou un livreur qui ouvrait un lien vers le tableau de bord d'un
 * commerce, était renvoyé à l'accueil sans un mot : il croyait le lien cassé. Il arrive maintenant dans Mon compte, où la
 * section « Mes casquettes » (MesCasquettes.jsx, POST /auth/roles) ajoute ce rôle au même compte, avec une ligne qui dit
 * pourquoi il est là. Utilisé par ProtectedRoute.jsx et par Auth.jsx (lien d'inscription partenaire ouvert connecté). */
export default function RedirectionRole({ role, vers = '/account' }) {
  const { t } = useLanguage();
  const toast = useToast();
  const dit = useRef(false);
  useEffect(() => {
    if (dit.current) return;
    dit.current = true;
    toast(t('auth.roleMissing', { role: t(`casquettes.nom_${role}`) }));
  }, [role, t, toast]);
  return <Navigate to={vers} replace />;
}
