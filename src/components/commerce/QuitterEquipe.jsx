import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../ConfirmDialog';
import LigneCompte from '../LigneCompte';

/* QUITTER L'ÉQUIPE D'UN COMMERCE (audit du 19/10, shop-410). Un membre qui changeait de travail ne pouvait pas partir : il
   devait demander au propriétaire ou supprimer son compte. Une rangée discrète sous « Mon équipe » de Mon compte, confirmée
   (ConfirmDialog) ; le serveur retire l'adhésion (DELETE /restaurants/:id/team/me) et la casquette « Commerce » si le compte
   ne sert plus nulle part. Ensuite, retour à l'accueil, sur la casquette qui reste. Composant à part : Account.jsx ne doit
   plus grossir (CLAUDE.md). */
export default function QuitterEquipe({ restaurant }) {
  const { token, refreshUser, changerRole } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const [ouverte, setOuverte] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function quitter() {
    setEnvoi(true);
    try {
      await api(`/restaurants/${restaurant.id}/team/me`, { method: 'DELETE', token });
      let u = null;
      try { u = await refreshUser?.(); } catch { /* la casquette se corrigera au prochain chargement */ }
      if (u && !(u.roles || []).includes('restaurant')) changerRole?.('client', u.roles);
      toast(t('team.leftToast', { name: restaurant.name }), 'succes');
      setOuverte(false);
      navigate('/', { replace: true });
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }

  return (
    <>
      <LigneCompte icone="porte" titre={t('team.leave')} danger onClick={() => setOuverte(true)} />
      <ConfirmDialog open={ouverte} danger
        title={t('team.leaveTitle')}
        message={t('team.leaveText', { name: restaurant.name })}
        confirmLabel={t('team.leave')}
        loading={envoi}
        onCancel={() => setOuverte(false)}
        onConfirm={quitter} />
    </>
  );
}
