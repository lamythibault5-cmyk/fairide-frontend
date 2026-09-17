import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import SousEcran from './SousEcran';
import AddressSearch from './AddressSearch';
import Icone from './Icone';

// LE CARNET D'ADRESSES : choisir où livrer, ou en ajouter une.
//
// Un compte n'avait qu'UNE adresse. Quelqu'un qui commande tantôt chez lui, tantôt au bureau devait
// la retaper à chaque fois — et comme rien ne la vérifiait, il pouvait y mettre n'importe quoi.
//
// Cet écran est calqué sur celui d'Uber Eats (capture du fondateur) : une recherche en haut, la liste
// des adresses enregistrées en dessous, celle en cours mise en évidence. Il s'ouvre des deux endroits
// où la question se pose — la liste des commerces, et le paiement — parce que c'est la même question.
//
// CE QUI ENTRE ICI EXISTE VRAIMENT. Le serveur géocode avant d'enregistrer et refuse une adresse
// qu'il ne connaît pas (POST /auth/me/addresses). C'était le trou : la commande refusait bien une
// fausse adresse, mais Mon compte l'enregistrait sans rien vérifier, et c'est cette adresse-là que
// tout le reste affichait. La vérification vit maintenant au point d'écriture, pas à l'arrivée.
export default function ChoixAdresse({ onFermer, onChoisie }) {
  const { t } = useLanguage();
  const { token, user, refreshUser } = useAuth();
  const toast = useToast();
  const [adresses, setAdresses] = useState(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    api('/auth/me/addresses', { token })
      .then(setAdresses)
      .catch(() => setAdresses([]));
  }, [token]);

  // L'adresse en cours sur le compte, pour la marquer dans la liste : on doit voir d'un coup d'œil
  // laquelle est retenue, sinon on ne sait pas si on vient de changer quelque chose.
  const enCours = (a) =>
    (user.addressStreet || '').toLowerCase() === (a.street || '').toLowerCase()
    && (user.addressNumber || '').toLowerCase() === (a.number || '').toLowerCase();

  async function choisir(a) {
    if (occupe) return;
    setOccupe(true);
    try {
      const r = await api(`/auth/me/addresses/${a.id}/select`, { method: 'POST', body: {}, token });
      await refreshUser?.();
      onChoisie?.(r.address || a);
      onFermer();
    } catch (e) {
      toast(e.message);
    } finally {
      setOccupe(false);
    }
  }

  async function ajouter(suggestion) {
    if (occupe) return;
    // La suggestion peut n'avoir que la rue (« numéro à compléter ») : sans numéro, on ne peut pas
    // livrer, et le serveur refuserait. On le dit ici plutôt que de laisser partir un appel perdu.
    if (!suggestion.number) { toast(t('adresses.needNumber')); return; }
    setOccupe(true);
    try {
      const creee = await api('/auth/me/addresses', {
        method: 'POST', token,
        body: { street: suggestion.street, number: suggestion.number, postalCode: suggestion.postalCode, city: suggestion.city }
      });
      setAdresses((l) => [...(l || []).filter((x) => x.id !== creee.id), creee]);
      await choisir(creee);
    } catch (e) {
      toast(e.message);
      setOccupe(false);
    }
  }

  async function supprimer(a, e) {
    e.stopPropagation(); // sans ça, supprimer choisirait aussi l'adresse : la rangée entière est un bouton
    try {
      await api(`/auth/me/addresses/${a.id}`, { method: 'DELETE', token });
      setAdresses((l) => (l || []).filter((x) => x.id !== a.id));
    } catch (err) {
      toast(err.message);
    }
  }

  return (
    <SousEcran titre={t('adresses.title')} onFermer={onFermer}>
      <AddressSearch onSelect={ajouter} />
      <h3 className="adresses-titre">{t('adresses.saved')}</h3>
      {adresses === null && <p className="small">{t('adresses.loading')}</p>}
      {adresses !== null && adresses.length === 0 && (
        <p className="small adresses-vide">{t('adresses.empty')}</p>
      )}
      {(adresses || []).map((a) => (
        <div key={a.id} className={`adresse-ligne${enCours(a) ? ' est-active' : ''}`}>
          <button type="button" className="adresse-choisir" onClick={() => choisir(a)} disabled={occupe}>
            <Icone nom={a.label ? 'maison' : 'position'} taille={20} />
            <span className="adresse-texte">
              <span className="adresse-nom">{a.label || `${a.street} ${a.number}`.trim()}</span>
              <span className="adresse-sous">
                {a.label ? `${a.street} ${a.number}, ${a.city}`.replace(' ,', ',') : `${a.postalCode} ${a.city}`.trim()}
              </span>
            </span>
          </button>
          {/* Supprimer, et non modifier comme chez Uber : une adresse est géocodée à l'enregistrement,
              donc la corriger reviendrait à en créer une autre. Supprimer puis rechercher est plus
              court, et évite une adresse dont les coordonnées ne correspondent plus au texte. */}
          <button
            type="button"
            className="adresse-supprimer"
            onClick={(e) => supprimer(a, e)}
            aria-label={t('adresses.remove', { adresse: `${a.street} ${a.number}` })}
            title={t('adresses.removeShort')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </SousEcran>
  );
}
