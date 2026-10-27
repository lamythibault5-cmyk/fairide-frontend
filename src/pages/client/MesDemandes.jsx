import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import EtatVide from '../../components/EtatVide';
import ErreurChargement from '../../components/ErreurChargement';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icone from '../../components/Icone';
import useFenetreDemande from '../../components/demandes/useFenetreDemande';
import { miennes, retirer, dessinDemande } from '../../demandes';
import '../../ecran-liste.css';
import '../../ecran-demandes.css';

/* MES DEMANDES (« Demande ton restaurant », fondateur, 2026-10-26 ; réponse 2 : Compte › Mes demandes). Les restaurants que
 * j'ai demandés, et où ils en sont, en douceur : « Demandé », « On en parle avec lui », « Bientôt » (un commerce « Carte
 * seule »), « Arrivé » (sa carte est en ligne : la ligne mène à sa fiche). Jamais « il a refusé ». Une demande se retire ici
 * (la croix) : le restaurant ne la compte plus. Même bandeau iris et feuille blanche que Mes favoris (ecran-liste.css). */
export default function MesDemandes() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [liste, setListe] = useState(null);
  const [echec, setEchec] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  const [retrait, setRetrait] = useState(false);
  const charger = () => { setEchec(false); return miennes(token).then((r) => setListe(r.demandes || [])).catch(() => setEchec(true)); };
  const { ouvrir, fenetre } = useFenetreDemande(charger);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [token]);

  async function confirmerRetrait() {
    setRetrait(true);
    try {
      await retirer(aRetirer.id, token);
      setListe((l) => l.filter((d) => d.id !== aRetirer.id));
      toast(t('demandes.toastRetire'));
      setARetirer(null);
    } catch (e) { toast(e.message, 'erreur'); } finally { setRetrait(false); }
  }

  const sousTitre = (d) => (d.etat === 'arrive' ? t('demandes.sous_arrive')
    : d.etat === 'bientot' ? t('demandes.sous_bientot')
      : d.etat === 'clos' ? t('demandes.sous_clos')
        : t('demandes.sous_progres', { n: d.total, objectif: d.objectif }));
  const n = liste?.length || 0;
  return (
    <div className="ecran-bandeau dm-mes">
      <div className="eb-bandeau">
        <h1 className="eb-titre">{t('demandes.mesTitre')}</h1>
        {liste && n > 0 && <p className="eb-sous">{t('demandes.rowSous')}</p>}
      </div>
      <div className="eb-feuille">
        {!liste && !echec && <p className="small">{t('demandes.recherche')}</p>}
        {echec && <ErreurChargement onReessayer={charger} />}
        {liste && n === 0 && (
          <EtatVide icone="demande" titre={t('demandes.mesVide')} texte={t('demandes.mesVideTexte')}>
            <button type="button" className="btn-outline" onClick={() => ouvrir('')}>{t('demandes.finBouton')}</button>
          </EtatVide>
        )}
        {liste && n > 0 && (
          <>
            <ul className="dm-mes-liste">
              {liste.map((d) => {
                const dessin = dessinDemande(d);
                const contenu = (
                  <>
                    <span className="dm-choix-tuile" aria-hidden="true">{dessin ? <img src={dessin} alt="" width="26" height="26" /> : <Icone nom="restaurants" taille={18} />}</span>
                    <span className="dm-choix-texte"><b>{d.nom}</b><small>{sousTitre(d)}</small></span>
                    <span className={`dm-statut dm-statut--${d.etat}`}>{t(`demandes.etat_${d.etat}`)}</span>
                  </>
                );
                return (
                  <li key={d.id} className="dm-mes-ligne">
                    {d.etat === 'arrive' && d.restaurantSlug
                      ? <Link className="dm-mes-corps" to={`/restaurants/${d.restaurantSlug}`}>{contenu}</Link>
                      : <div className="dm-mes-corps">{contenu}</div>}
                    {d.etat !== 'arrive' && (
                      <button type="button" className="dm-mes-retirer" onClick={() => setARetirer(d)} aria-label={`${t('demandes.mesRetirerAide')} : ${d.nom}`} title={t('demandes.mesRetirerAide')}>
                        <Icone nom="croix" taille={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn-outline dm-mes-autre" onClick={() => ouvrir('')}><Icone nom="demande" taille={18} />{t('demandes.finBouton')}</button>
          </>
        )}
      </div>
      <ConfirmDialog open={!!aRetirer} icone="croix" title={t('demandes.retirerTitre')} message={aRetirer ? t('demandes.retirerTexte', { nom: aRetirer.nom }) : ''}
        confirmLabel={t('demandes.retirerBouton')} loading={retrait} onConfirm={confirmerRetrait} onCancel={() => setARetirer(null)} />
      {fenetre}
    </div>
  );
}
